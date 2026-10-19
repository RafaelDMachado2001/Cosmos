locals {
  admin_host = "admin.${var.domain}"
  api_host   = "api.${var.domain}"
  media_host = "media.${var.domain}"
  tick_url   = "https://${local.api_host}/api/internal/tick"

  services = [
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "secretmanager.googleapis.com",
    "cloudscheduler.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "sts.googleapis.com",
  ]

  # O que não é segredo vai em texto, igual ao backend/.env.production.example.
  plain_env = {
    APP_NAME                  = "RDM Labs"
    APP_URL                   = "https://${local.admin_host}"
    DB_CONNECTION             = "pgsql"
    DB_SSLMODE                = "require"
    SESSION_DRIVER            = "database"
    SESSION_SECURE_COOKIE     = "true"
    SESSION_DOMAIN            = ".${var.domain}"
    CACHE_STORE               = "database"
    QUEUE_CONNECTION          = "database"
    MEDIA_DISK                = "s3"
    MEDIA_S3_BUCKET           = cloudflare_r2_bucket.media.name
    MEDIA_S3_ENDPOINT         = "https://${var.cloudflare_account_id}.r2.cloudflarestorage.com"
    MEDIA_URL                 = "https://${local.media_host}"
    SITE_REBUILD_DRIVER       = "vercel"
    SCHEDULER_OIDC_AUDIENCE   = local.tick_url
    SCHEDULER_SERVICE_ACCOUNT = google_service_account.scheduler.email
    ADMIN_HOST                = local.admin_host
    API_HOST                  = local.api_host
    ADMIN_EMAIL               = var.admin_email
    GOOGLE_REDIRECT_URI       = "https://${local.admin_host}/admin/login/google/callback"
    SITE_URL                  = "https://${var.site_host}"
  }

  # Segredos: o Terraform cria o recipiente, nunca o valor — quem grava a
  # versão é `gcloud secrets versions add` (README). Assim nenhum deles passa
  # pelo state. A exceção é EDGE_SHARED_SECRET, gerado aqui (borda).
  external_secrets = {
    APP_KEY                  = "app-key"
    DB_URL                   = "database-url"
    MEDIA_S3_KEY             = "media-s3-key"
    MEDIA_S3_SECRET          = "media-s3-secret"
    VERCEL_DEPLOY_HOOK_URL   = "vercel-deploy-hook"
    GOOGLE_CLIENT_ID         = "google-client-id"
    GOOGLE_CLIENT_SECRET     = "google-client-secret"
    GITHUB_CLIENT_ID         = "github-client-id"
    GITHUB_CLIENT_SECRET     = "github-client-secret"
    PRERENDER_INTERNAL_TOKEN = "prerender-internal-token"
  }
}

resource "google_project_service" "enabled" {
  for_each           = toset(local.services)
  service            = each.value
  disable_on_destroy = false
}

# --- Imagens -----------------------------------------------------------------

resource "google_artifact_registry_repository" "images" {
  repository_id = "cosmos"
  format        = "DOCKER"
  location      = var.region

  # Só as três últimas: cada merge na main empurra uma, e 0,5 GB é o que o
  # Artifact Registry dá de graça. Três ainda cobrem um rollback.
  cleanup_policies {
    id     = "manter-tres"
    action = "KEEP"
    most_recent_versions {
      keep_count = 3
    }
  }

  depends_on = [google_project_service.enabled]
}

# --- Contas de serviço -------------------------------------------------------

resource "google_service_account" "runtime" {
  account_id   = "cosmos-api"
  display_name = "Cosmos: o contêiner da API e do painel"
}

resource "google_service_account" "scheduler" {
  account_id   = "cosmos-scheduler"
  display_name = "Cosmos: assina o tick do Cloud Scheduler"
}

# --- Segredos ----------------------------------------------------------------

resource "google_secret_manager_secret" "external" {
  for_each  = local.external_secrets
  secret_id = each.value

  replication {
    auto {}
  }

  depends_on = [google_project_service.enabled]
}

resource "google_secret_manager_secret" "edge" {
  secret_id = "edge-shared-secret"

  replication {
    auto {}
  }

  depends_on = [google_project_service.enabled]
}

resource "google_secret_manager_secret_version" "edge" {
  secret      = google_secret_manager_secret.edge.id
  secret_data = random_password.edge.result
}

resource "google_secret_manager_secret_iam_member" "runtime" {
  for_each  = merge({ for name, id in local.external_secrets : name => google_secret_manager_secret.external[name].id }, { EDGE_SHARED_SECRET = google_secret_manager_secret.edge.id })
  secret_id = each.value
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.runtime.email}"
}

# --- Cloud Run ---------------------------------------------------------------

locals {
  secret_env = merge(
    { for name, id in local.external_secrets : name => google_secret_manager_secret.external[name].secret_id },
    { EDGE_SHARED_SECRET = google_secret_manager_secret.edge.secret_id },
  )
}

resource "google_cloud_run_v2_service" "api" {
  name                = "cosmos-api"
  location            = var.region
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = false

  template {
    service_account                  = google_service_account.runtime.email
    max_instance_request_concurrency = 40

    # Zero quando ninguém usa; o teto protege o Neon e a conta.
    scaling {
      min_instance_count = 0
      max_instance_count = 3
    }

    containers {
      image = var.image

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        cpu_idle          = true
        startup_cpu_boost = true
      }

      dynamic "env" {
        for_each = local.plain_env
        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = local.secret_env
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = env.value
              version = "latest"
            }
          }
        }
      }

      # O entrypoint roda env:assert-production antes de abrir a porta: uma
      # revisão mal configurada nunca passa daqui e o tráfego fica na anterior.
      startup_probe {
        http_get {
          path = "/up"
        }
        initial_delay_seconds = 2
        period_seconds        = 3
        failure_threshold     = 10
      }
    }
  }

  lifecycle {
    # Quem troca a imagem é o pipeline (.github/workflows/deploy.yml).
    ignore_changes = [template[0].containers[0].image, client, client_version]
  }

  depends_on = [google_secret_manager_secret_iam_member.runtime]
}

# A Cloudflare chama sem credencial do Google; quem barra é o VerifyEdge.
resource "google_cloud_run_v2_service_iam_member" "public" {
  name     = google_cloud_run_v2_service.api.name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# As migrações, antes de cada revisão nova (deploy.yml).
resource "google_cloud_run_v2_job" "migrate" {
  name                = "cosmos-migrate"
  location            = var.region
  deletion_protection = false

  template {
    task_count = 1

    template {
      service_account = google_service_account.runtime.email
      max_retries     = 0
      timeout         = "300s"

      containers {
        image = var.image
        args  = ["php", "artisan", "migrate", "--force"]

        dynamic "env" {
          for_each = local.plain_env
          content {
            name  = env.key
            value = env.value
          }
        }

        dynamic "env" {
          for_each = local.secret_env
          content {
            name = env.key
            value_source {
              secret_key_ref {
                secret  = env.value
                version = "latest"
              }
            }
          }
        }
      }
    }
  }

  lifecycle {
    ignore_changes = [template[0].template[0].containers[0].image, client, client_version]
  }

  depends_on = [google_secret_manager_secret_iam_member.runtime]
}

# --- Agendador ---------------------------------------------------------------

# A cada 15 minutos, não a cada minuto: todo tick acorda o Neon, que só
# suspende depois de 5 minutos parado. De minuto em minuto o banco nunca
# dormiria e estouraria as horas de computação do plano gratuito. O preço:
# uma publicação agendada sai em até 15 minutos, e o último rebuild de uma
# rajada de edições também (o salvar comum dispara na hora).
resource "google_cloud_scheduler_job" "tick" {
  name      = "cosmos-tick"
  region    = var.region
  schedule  = "*/15 * * * *"
  time_zone = "America/Sao_Paulo"

  # Pela borda, como qualquer requisição: o Worker repassa, o Laravel valida
  # o token OIDC (VerifyGoogleOidc) contra esta audiência e esta conta.
  http_target {
    uri         = local.tick_url
    http_method = "POST"

    oidc_token {
      service_account_email = google_service_account.scheduler.email
      audience              = local.tick_url
    }
  }

  retry_config {
    retry_count = 0
  }

  depends_on = [google_project_service.enabled]
}


resource "cloudflare_r2_bucket" "media" {
  account_id = var.cloudflare_account_id
  name       = "rdm-labs-media"
}

resource "random_password" "edge" {
  length  = 48
  special = false
}

resource "cloudflare_workers_script" "edge" {
  account_id = var.cloudflare_account_id
  name       = "cosmos-edge"
  content    = file("${path.module}/cloudflare/edge-worker.js")
  module     = true

  plain_text_binding {
    name = "ORIGIN"
    text = google_cloud_run_v2_service.api.uri
  }

  secret_text_binding {
    name = "EDGE_SECRET"
    text = random_password.edge.result
  }
}

resource "cloudflare_record" "edge" {
  for_each = toset(["admin", "api"])

  zone_id = var.cloudflare_zone_id
  name    = each.value
  type    = "AAAA"
  content = "100::"
  proxied = true
  comment = "Worker cosmos-edge -> Cloud Run (Terraform)"
}

resource "cloudflare_workers_route" "edge" {
  for_each = toset([local.admin_host, local.api_host])

  zone_id     = var.cloudflare_zone_id
  pattern     = "${each.value}/*"
  script_name = cloudflare_workers_script.edge.name
}

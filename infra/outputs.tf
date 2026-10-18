output "run_url" {
  description = "A URL *.run.app do serviço (só responde pela borda)."
  value       = google_cloud_run_v2_service.api.uri
}

output "image_repository" {
  description = "Para onde o pipeline envia a imagem."
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.images.repository_id}/api"
}

output "workload_identity_provider" {
  description = "Vai na variável GCP_WORKLOAD_IDENTITY_PROVIDER do repositório."
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "deployer_service_account" {
  description = "Vai na variável GCP_DEPLOYER_SA do repositório."
  value       = google_service_account.deployer.email
}

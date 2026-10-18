variable "project_id" {
  description = "Projeto do Google Cloud."
  type        = string
}

variable "region" {
  description = "Região do Cloud Run, do Artifact Registry e do Scheduler."
  type        = string
  default     = "southamerica-east1"
}

variable "github_repository" {
  description = "Repositório que pode publicar, no formato dono/nome."
  type        = string
  default     = "RafaelDMachado2001/Cosmos"
}

variable "image" {
  description = "Imagem da primeira revisão. Depois disso, quem troca a imagem é o pipeline (ignore_changes)."
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "cloudflare_account_id" {
  type = string
}

variable "cloudflare_zone_id" {
  description = "Zona do rdmlabs.com.br na Cloudflare."
  type        = string
}

variable "domain" {
  type    = string
  default = "rdmlabs.com.br"
}

variable "site_host" {
  type    = string
  default = "cosmos.rdmlabs.com.br"
}

variable "admin_email" {
  description = "O único endereço que entra no painel (allowlist do login Google)."
  type        = string
}

terraform {
  required_version = ">= 1.9"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.10"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.45"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # State remoto num bucket GCS com versionamento (criado à mão uma vez, ver
  # README). O nome vem de `terraform init -backend-config=state.gcs.tfbackend`.
  backend "gcs" {
    prefix = "cosmos"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Token da Cloudflare em CLOUDFLARE_API_TOKEN, nunca no código.
provider "cloudflare" {}

# Infraestrutura

O backend em produção: Cloud Run (API e painel), Cloud Scheduler (o tick),
Artifact Registry, Secret Manager e a federação de identidade do GitHub, mais a
borda e a mídia na Cloudflare. A arquitetura está em `docs/architecture.md`.

| Arquivo | O que cria |
|---|---|
| `gcp.tf` | APIs, repositório de imagens, contas de serviço, segredos, serviço e job de migração no Cloud Run, o tick |
| `github.tf` | Workload Identity Federation: o deploy da `main` sem chave JSON |
| `cloudflare.tf` | Bucket R2, o Worker da borda (`cloudflare/edge-worker.js`), as rotas e os registros de `admin.` e `api.` |

Fora do Terraform, de propósito:
- **O Neon.** O projeto é criado à mão e a connection string vai para o
  segredo `database-url`. Fica como dívida, para virar código depois.
- **Os valores dos segredos.** O Terraform cria o recipiente; o valor entra por
  `gcloud`, então nenhum segredo de terceiro passa pelo state. A exceção é o
  segredo da borda, que o próprio Terraform gera e entrega ao Worker e ao
  Cloud Run.
- **O domínio da mídia.** `media.rdmlabs.com.br` é ligado ao bucket no painel do
  R2 (Settings → Custom Domains): a versão 4 do provedor não tem esse recurso.

## Primeira vez

Precisa de `gcloud` autenticado como dono do projeto e de um token da Cloudflare
em `CLOUDFLARE_API_TOKEN`, com estas permissões:
- Workers Scripts e Workers Routes: edição;
- DNS da zona: edição;
- R2: edição.

1. **Bucket do state**, uma vez, com versionamento:

   ```sh
   gcloud storage buckets create gs://rdm-labs-cosmos-tfstate --location=southamerica-east1 --uniform-bucket-level-access
   gcloud storage buckets update gs://rdm-labs-cosmos-tfstate --versioning
   ```

2. **Variáveis:** copiar `terraform.tfvars.example` para `terraform.tfvars` e
   `state.gcs.tfbackend.example` para `state.gcs.tfbackend`, e preencher.

3. **Aplicar em duas passadas.** O Cloud Run recusa uma revisão que lê um
   segredo sem versão, então primeiro só os recipientes dos segredos, depois os
   valores (passo 4), e só então o resto:

   ```sh
   terraform init -backend-config=state.gcs.tfbackend
   terraform apply -target=google_secret_manager_secret.external
   # passo 4: gravar os valores
   terraform apply
   ```

   Sem Terraform instalado, o mesmo pela imagem oficial, com as credenciais do
   `gcloud auth application-default login`:

   ```sh
   docker run --rm -it -v "$PWD:/w" -w /w \
     -v "$HOME/.config/gcloud:/root/.config/gcloud:ro" \
     -e CLOUDFLARE_API_TOKEN hashicorp/terraform:1.9 apply
   ```

   A primeira revisão sobe com uma imagem de exemplo do Google. A imagem do
   Cosmos chega no primeiro deploy pelo pipeline.

4. **Valores dos segredos** (entre as duas passadas do passo 3):

   ```sh
   printf '%s' 'base64:...' | gcloud secrets versions add app-key --data-file=-
   ```

   | Segredo | Valor |
   |---|---|
   | `app-key` | `php artisan key:generate --show` |
   | `database-url` | A connection string do Neon (endpoint com pooler, `sslmode=require`) |
   | `media-s3-key`, `media-s3-secret` | Um token de API do R2 com leitura e escrita só neste bucket |
   | `vercel-deploy-hook` | Vercel → Settings → Git → Deploy Hooks, na branch `main` |
   | `google-client-id`, `google-client-secret` | O cliente OAuth do Google, o mesmo para o painel e para os leitores. Duas URIs de redirecionamento autorizadas: `https://admin.rdmlabs.com.br/admin/login/google/callback` e `https://api.rdmlabs.com.br/auth/google/callback` |
   | `github-client-id`, `github-client-secret` | Um OAuth App do GitHub (Settings → Developer settings), só para os leitores. Callback: `https://api.rdmlabs.com.br/auth/github/callback` |
   | `prerender-internal-token` | O mesmo valor de `PRERENDER_INTERNAL_TOKEN` no projeto da Vercel |

5. **Variáveis do repositório no GitHub** (Settings → Secrets and variables →
   Actions → Variables), com as saídas do `terraform output`:
   - `GCP_PROJECT_ID`;
   - `GCP_REGION`;
   - `GCP_WORKLOAD_IDENTITY_PROVIDER`;
   - `GCP_DEPLOYER_SA`;
   - `GCP_IMAGE_REPOSITORY`.

6. **Variáveis do projeto na Vercel:**
   - `VITE_API_URL` e `PRERENDER_API_URL`: os dois iguais a `https://api.rdmlabs.com.br`;
   - `PRERENDER_INTERNAL_TOKEN`: o mesmo valor do segredo `prerender-internal-token`.

## Limites que valem saber

- **Workers grátis:** 100 mil requisições por dia, somando painel, API e as
  leituras da constelação. Na abertura ao público, o plano pago (US$ 5/mês)
  tira o teto.
- **Escala:** o Cloud Run vai de 0 a 3 instâncias, com 40 requisições
  simultâneas por instância. Na abertura ao público, `min_instance_count = 1`
  evita a partida a frio.

# Deploy e identidade: plano das etapas 1 e 2

> **Objetivo da etapa 1:** pôr o backend no ar sem servidor para administrar. O site continua
> na Vercel e passa a ler da API, e publicar no Studio atualiza o site público.
>
> **Objetivo da etapa 2:** contas de leitor (login social) separadas do admin, com o registro
> de atividades que a comunidade e a gamificação vão consumir depois.
>
> **Arquitetura:** `docs/architecture.md`. Este plano argumenta a partir dele.
>
> **Stack nova:**
> - Google Cloud Run, Cloud Scheduler, Artifact Registry e Secret Manager;
> - Neon (Postgres 16);
> - Cloudflare R2 (mídia);
> - Terraform;
> - Laravel Sanctum (etapa 2).

## Restrições globais

Valem para toda tarefa, além das regras do `CLAUDE.md`.

- **O site nunca depende do backend para ser lido.** Nenhuma tarefa pode pôr uma chamada à API
  no caminho da primeira pintura de um artigo. Comunidade carrega depois.
- **O contêiner não guarda estado no disco.** Sessão, cache e fila ficam no banco; mídia, no
  R2. Uma instância do Cloud Run pode morrer a qualquer momento.
- **O `docker compose` local continua funcionando** como hoje, inclusive o e2e do Studio.
  Produção e desenvolvimento divergem por variável de ambiente, nunca por branch de código.
- **Nenhum segredo no repositório nem no Terraform state em texto.** Segredos ficam no Secret
  Manager, e o CI autentica por Workload Identity Federation, sem chave JSON.
- **Um commit por tarefa**, com as verificações do pre-commit passando.

## Decisões em aberto

Preciso da sua resposta antes da tarefa indicada.

| # | Decisão | Recomendação | Antes de |
|---|---|---|---|
| D1 | Região do Cloud Run e do Neon | **Decidido:** São Paulo, com um Worker da Cloudflare na frente. O mapeamento de domínio do Cloud Run não existe nessa região. | 1.6 |
| D2 | Hosts | **Decidido:** `api.rdmlabs.com.br` e `admin.rdmlabs.com.br`. Os registros são do Terraform (`infra/cloudflare.tf`). | 1.4 |
| D3 | Provedores de login do leitor | Google e GitHub | 2.3 |
| D4 | Interface de login no site | Pedir um handoff ao Claude Design: o `CLAUDE.md` proíbe inventar cor, fonte ou espaçamento | 2.6 |
| D5 | Ligar contas do mesmo e-mail entre provedores | Só quando os dois provedores declaram o e-mail verificado | 2.3 |

---

# Etapa 1: backend no ar

### Tarefa 1.1: mídia no R2

**Por quê:** o upload grava em `storage/app/public`, que some com a instância.

- [ ] Disco `media` com o driver `s3` do Laravel apontando para o R2 (endpoint, bucket e
  `url` vindos de variáveis de ambiente). Em desenvolvimento, o mesmo disco aponta para o disco
  local de hoje, para o `docker compose` não precisar de credencial.
- [ ] `MediaController` e `MediaResource` passam a usar o disco `media`.
- [ ] Comando `media:migrate-to-r2`:
  - envia os arquivos existentes ao bucket;
  - reescreve o prefixo `/storage/media/` no `body` publicado e nos blocos `img` dos rascunhos.

  É idempotente: rodar duas vezes não muda nada.
- [ ] `img-src` da CSP (`vercel.json` e o snippet do Nginx) inclui o domínio da mídia.
- [ ] **Testes:**
  - `Storage::fake('media')` no upload;
  - teste do comando de migração com um corpo que cita a mesma imagem duas vezes e um link
    externo que não pode ser tocado.

### Tarefa 1.2: regeneração pelo deploy hook da Vercel

**Por quê:** `RegenerateSite` grava páginas num volume que o Nginx serve. Na Vercel não há
volume, e o build já sabe ler da API.

- [ ] `SiteRebuild`, um serviço com dois métodos:
  - `markDirty()`: grava `site_dirty_at` no cache;
  - `flush()`: chama o deploy hook se o site está sujo e o último disparo foi há mais de 60s.
- [ ] O `PublicationObserver` chama `markDirty()` e depois `flush()` depois da resposta
  (`dispatch()->afterResponse()`), sem depender de worker.
- [ ] O tick do agendador (tarefa 1.3) chama `flush()`, que dispara o rebuild pendente.
  Dez salvamentos seguidos custam um build, não dez.
- [ ] Em desenvolvimento, `SITE_REBUILD_DRIVER=local` mantém o `RegenerateSite` de hoje.
  Em produção, o driver é `vercel`, com a URL do hook no Secret Manager.
- [ ] Variáveis no projeto da Vercel:
  - `VITE_API_URL=https://api.rdmlabs.com.br`;
  - `PRERENDER_API_URL` com o mesmo valor;
  - `PRERENDER_INTERNAL_TOKEN`, que isenta o build do throttle.
- [ ] O adaptador HTTP tolera `locales` ausente no detalhe (`?? LOCALES`). Hoje um `.filter`
  sobre `undefined` derrubaria o build contra uma API um deploy atrás.
- [ ] `connect-src` da CSP do `vercel.json` passa a ser só `'self'` mais o host da API, sem o
  `https:` genérico.
- [ ] **Testes:**
  - `Http::fake` no hook;
  - dois `markDirty` seguidos com um `flush` no meio disparam uma vez;
  - um `flush` 61s depois dispara a segunda;
  - falha do hook não derruba o salvamento, e o site continua sujo para o próximo tick.
- [ ] **Aceite:** o 404 de um artigo recém-publicado dura até o build terminar (1 a 2 minutos).
  Antes era o `@app` do Nginx. Fica documentado no `CLAUDE.md` como troca consciente.

### Tarefa 1.3: agendador como chamada HTTP

**Por quê:** `schedule:work` precisa de um processo sempre ligado. Com escala a zero, ele não
existe.

- [ ] Rota `POST /internal/tick`, autenticada por OIDC: o Cloud Scheduler assina a chamada com
  uma conta de serviço, e um middleware valida o token do Google e o `aud`.
- [ ] A rota roda `publications:publish-scheduled` e depois `SiteRebuild::flush()`.
- [ ] O serviço `scheduler` do compose continua para o desenvolvimento local.
- [ ] **Testes:**
  - sem token, 401;
  - token de outra audiência, 401;
  - token válido, a publicação vencida vira `published` e o site fica sujo.

### Tarefa 1.4: dois hosts, uma aplicação

**Por quê:** a etapa 2 vai precisar de um cookie de sessão no domínio do site. O do admin
não pode ir junto (ver "Two hosts, one app" no documento de arquitetura).

- [ ] Middleware `SessionByHost`, antes do `StartSession`:
  - no host do admin, cookie `rdm_admin`, só do host e `SameSite=Lax`;
  - no host da API, cookie `rdm_session` com `SESSION_DOMAIN` do site.
- [ ] Rotas `/admin/*` e `/livewire/*` só respondem no host do admin; `/api/*`, só no da API.
  No host errado, 404.
- [ ] Callback do Google do admin passa para `https://admin.rdmlabs.com.br/admin/login/google/callback`.
  Cadastrar no Google Cloud Console.
- [ ] Em desenvolvimento, sem hosts configurados, tudo responde em `localhost:8080` como hoje.
- [ ] **Testes:**
  - o cookie do admin sai sem `Domain`;
  - `/admin/studio` no host da API dá 404;
  - `/api/publications` no host do admin dá 404.

### Tarefa 1.5: imagem de produção

- [ ] Novo estágio `production` no `docker/php/Dockerfile`, com FrankenPHP: servidor HTTP e
  PHP num processo só, que é o que o Cloud Run espera, sem Nginx dentro do contêiner.
  `composer install --no-dev`, `config:cache`, `route:cache`, `view:cache` e OPcache com
  `validate_timestamps=0`.
- [ ] A imagem leva Node só para o `DraftBlocksCli`: o binário e `dist-ssr/draft-blocks-cli.js`.
  Conferir que o bundle não importa nada de `node_modules`. Se importar, empacotar com
  `noExternal`. O prerender e o `RegenerateSite` ficam fora da imagem de produção.
- [ ] Os assets do Filament e do Studio vão na imagem (`public/`), não por bind mount.
- [ ] `php artisan check:env` em produção passa a exigir:
  - `SESSION_SECURE_COOKIE=true`;
  - `APP_URL` em `https`;
  - o driver `vercel` de rebuild;
  - o disco `media` no R2.
- [ ] **Teste:** o CI builda o estágio `production` e sobe o contêiner. `/up` responde 200 e
  `/api/publications` responde 200 contra um Postgres de serviço.

### Tarefa 1.6: infraestrutura em Terraform

- [ ] `infra/` com os módulos:

  | Módulo | O que cria |
  |---|---|
  | `gcp` | Artifact Registry, Cloud Run (serviço e job de migração), Cloud Scheduler, Secret Manager, contas de serviço, Workload Identity Federation para o GitHub |
  | `cloudflare` | Bucket R2, domínio da mídia, registros DNS de `api.` e `admin.` |
- [ ] State remoto num bucket do GCS com versionamento.
- [ ] O Neon fica fora do Terraform na primeira volta: o projeto é criado à mão e a connection
  string vai para o Secret Manager. Isso fica registrado como dívida.
- [ ] Cloud Run com `min-instances=0`, `max-instances=3` e concorrência 40. O teto protege a
  conta do Neon e o bolso.
- [ ] **Aceite:** `terraform plan` limpo depois do `apply`; nenhum segredo no state.

### Tarefa 1.7: pipeline de deploy

- [ ] Job `deploy` no GitHub Actions, só na `main`, depois dos jobs de hoje:
  1. builda o estágio `production` e envia ao Artifact Registry com a tag do SHA;
  2. roda o job `migrate` no Cloud Run (`php artisan migrate --force`) e espera terminar;
  3. publica a revisão nova com o tráfego em 100%.

  Se a migração falha, a revisão antiga continua servindo.
- [ ] Ambiente `production` do GitHub com aprovação manual na primeira volta.
- [ ] **Aceite:**
  - um merge na `main` põe a API nova no ar sem passo manual;
  - `gcloud run revisions list` mostra a revisão com o SHA.

### Tarefa 1.8: virada

- [ ] Banco do Neon migrado e semeado (`migrate --seed`), com o admin pelo `ADMIN_EMAIL`.
- [ ] Rodar `media:migrate-to-r2` com a mídia local.
- [ ] Na Vercel, setar `VITE_API_URL` e disparar o deploy.
- [ ] **Teste de fumaça (roteiro no PR):**
  - entrar em `admin.rdmlabs.com.br` com o Google;
  - criar uma publicação com imagem e publicá-la;
  - em até 2 minutos, ela aparece em `cosmos.rdmlabs.com.br` com a imagem vinda do R2;
  - despublicar faz a URL voltar a dar 404.
- [ ] Atualizar o `CLAUDE.md` (fase 16) e a seção "Current state" de `docs/architecture.md`.

---

# Etapa 2: identidade do leitor

> **Estado:** o backend está feito (PR da fase 17). Ficam para depois do handoff de interface
> (D4): a interface de login no site, a página de privacidade com o link no rodapé, o
> `form-action` da CSP (o login é um link, não um formulário, até o handoff dizer outra coisa) e
> o e2e com sessão de leitor. O `e2e:member-session` já existe.
>
> Duas mudanças em relação ao plano: o registro de atividades virou um módulo próprio
> (`Activity`), que escuta os eventos do `Identity`, e o export usa o contrato
> `PersonalDataSource` para juntar o que cada módulo guarda sem que o `Identity` os importe.

### Tarefa 2.1: módulos no backend

- [x] Estrutura `app/Modules/{Content,Identity}`. O que existe hoje vai para `Content`, movendo
  sem mudar comportamento: a suíte inteira tem de passar sem nenhum teste alterado além dos
  `use`.
- [x] Regra checada no CI pelo PHPStan (ou pelo Deptrac): `Identity` não importa nada de
  `Content`, e o contrário também. A conversa é por eventos.

### Tarefa 2.2: contas de leitor

- [x] Tabelas:

  | Tabela | Colunas |
  |---|---|
  | `members` | `id`, `name`, `handle` (único, minúsculo), `avatar_url`, `email`, `email_verified_at`, `locale`, timestamps, `deleted_at` |
  | `member_identities` | `member_id`, `provider`, `provider_user_id` (único por provedor) |

  Diferente do admin, aqui o vínculo é pelo id do provedor, não pelo e-mail: são milhares de
  contas e e-mail muda.
- [x] Guard `member` (driver `session`, provider `members`). O guard `web` do admin não muda e
  nunca enxerga um `Member`.
- [x] **Testes:**
  - uma sessão de admin não autentica no guard `member`, e o contrário também;
  - `handle` duplicado recebe sufixo numérico.

### Tarefa 2.3: login social

- [x] Socialite com Google e GitHub (D3) em `api.rdmlabs.com.br/auth/{provider}/redirect` e
  `/callback`, com `throttle:10,1` como no admin.
- [x] Recusar e-mail não verificado. No GitHub, buscar o e-mail primário verificado pela API de
  e-mails quando o perfil o esconde.
- [x] Ligação entre provedores conforme D5.
- [x] Depois do callback, `session()->regenerate()` e redirecionar para a URL de onde a pessoa
  veio. A URL de retorno é validada: só caminhos do próprio site, nunca outro host
  (redirecionamento aberto).
- [x] **Testes:**
  - primeiro login cria conta e identidade;
  - segundo login reaproveita;
  - e-mail não verificado é recusado;
  - `?return=https://evil.example` volta para a home.

### Tarefa 2.4: API autenticada (Sanctum SPA)

- [x] `laravel/sanctum` com `stateful` igual ao host do site.
- [x] CORS com `supports_credentials` e origem exata do site nas rotas `/api/me*` e `/auth/*`.
  O `GET` público continua aberto como hoje.
- [x] Rotas:

  | Rota | Função |
  |---|---|
  | `GET /api/me` | Perfil, ou 204 sem sessão |
  | `PATCH /api/me` | Nome, handle e idioma |
  | `POST /auth/logout` | Encerra a sessão |
  | `DELETE /api/me` | Anonimiza e apaga (tarefa 2.7) |
- [x] **Testes:**
  - CSRF exigido no `PATCH`;
  - origem de outro site recusada pelo CORS;
  - `/api/me` sem sessão devolve 204, não 401, para o site não poluir o console.

### Tarefa 2.5: registro de atividades

- [x] Tabela `activities`, append-only:

  | Coluna | Exemplo |
  |---|---|
  | `id` | |
  | `member_id` | |
  | `verb` | `member.registered` |
  | `subject_type`, `subject_id` | |
  | `payload` | `jsonb` |
  | `occurred_at` | |

  Sem `updated_at`. O modelo não expõe `update`, e a migração cria um gatilho no Postgres que
  recusa `UPDATE` e `DELETE` (exceto a anonimização da tarefa 2.7).
- [x] O evento de domínio `MemberRegistered` grava a primeira atividade.
- [x] Não registrar login nem leitura: só ações de domínio. É menos dado pessoal e não muda
  nada para a gamificação.
- [x] **Testes:**
  - o cadastro gera exatamente uma atividade;
  - `UPDATE` direto no banco falha.

### Tarefa 2.6: o site com sessão

- [x] `src/core/`: tipos e estados de sessão (`anonymous`, `member`, `loading`), puros e
  testados.
- [x] Adaptador `createMemberSource`, como o `PublicationsSource`, com `credentials: 'include'`
  e o cabeçalho `X-XSRF-TOKEN`.
- [ ] Interface conforme o handoff (D4), montada só no cliente. O HTML pré-renderizado
  continua anônimo e igual para todos, senão o CDN não serve.
- [ ] CSP do `vercel.json`: `connect-src` com o host da API; `form-action` com o host da API,
  por causa do redirect do login.
- [ ] **Testes:**
  - jsdom: estado anônimo sem cookie, perfil depois do login simulado;
  - e2e com `php artisan e2e:member-session`, no mesmo padrão do `e2e:admin-session` e com a
    mesma trava fora de `local`/`testing`.

### Tarefa 2.7: o mínimo de LGPD que nasce junto

- [x] `DELETE /api/me`:
  - apaga as identidades;
  - anonimiza o `member`: nome "Conta removida", handle aleatório, e-mail e avatar nulos;
  - mantém as atividades sem dado pessoal, para os números agregados não mudarem.
- [x] `GET /api/me/export`: o JSON com perfil e atividades.
- [ ] Página de privacidade estática nos dois idiomas, gerada pelo prerender, com link no rodapé.
  O texto jurídico é seu; o plano só reserva o lugar.
- [x] Nenhum cookie além do de sessão e do CSRF, os dois essenciais, então não há banner de
  consentimento. Analytics, quando vier, pede consentimento.
- [x] **Testes:**
  - depois do `DELETE`, nenhuma coluna do membro tem o e-mail antigo;
  - o export tem as atividades.

### Tarefa 2.8: fechamento

- [x] Atualizar o `docs/architecture.md`: Identity sai de "planned".
- [x] Atualizar o `CLAUDE.md` com as decisões da fase.
- [x] Roteiro de teste manual no PR: login com Google e GitHub, editar perfil, sair, apagar a
  conta.

---

## Fora deste plano

- **Comentários, compartilhamento e moderação** (etapa 3). Precisam de anti-spam (Turnstile) e
  fila de aprovação, que entram junto.
- **Monitoramento** (Sentry, métricas e alertas). Entra antes da abertura ao público (etapa 4),
  junto com backups testados do Neon.
- **Gamificação** (etapa 5). Um módulo que projeta pontos a partir de `activities`.
- **Itens da auditoria que ficaram de fora:**
  - cache das imagens `/og/`;
  - gzip do XML;
  - RSS com `<language>`;
  - `safeUrl` aceitando `//host`;
  - limite de dimensões da imagem no upload.

  São pequenos e podem entrar em qualquer tarefa que toque o mesmo arquivo.

## Riscos

| Risco | Mitigação |
|---|---|
| Pooler do Neon incompatível com prepared statements do PDO | Testar a connection string com pooler na tarefa 1.5; se falhar, `PDO::ATTR_EMULATE_PREPARES` |
| Partida a frio do Cloud Run no primeiro build do dia | Aceitável na etapa 1 (só o admin e o build esperam); na abertura ao público, `min-instances=1` |
| Build da Vercel lendo uma API que acabou de mudar de contrato | O deploy da API vem antes do site. O contrato só cresce, e o adaptador tolera campo ausente: hoje o `locales` (PR #28) não tolera. A tarefa 1.2 corrige com `?? LOCALES` e um teste |
| Custo inesperado | `max-instances` no Cloud Run, alerta de orçamento no GCP, limites dos planos gratuitos de Neon e R2 |

# Painel profissional — desenho da fase 12

Estado: aprovado em 15/10/2026. Sucede a fase 11 (blocos de leitura).
Corresponde à "Spec C" citada em `docs/superpowers/specs/2026-09-18-publicacao-viva-design.md`.

## O problema

O painel e a API públicos saíram da fase 8 funcionais, mas não prontos para operar
sem supervisão:

- Login é e-mail/senha: uma senha para vazar, adivinhar ou reusar em outro lugar.
  Um painel de um autor só não precisa desse risco.
- A API pública (`/api/publications*`) não tem limite de taxa nenhum —
  `bootstrap/app.php` não chama `throttleApi()` e nenhum `RateLimiter::for('api', ...)`
  está registrado. Um scraper agressivo ou um laço de retentativa com bug não
  encontra fricção nenhuma.
- `published_at` no futuro com `status = published` aparece **imediatamente**: a
  consulta pública (`PublicationController::published()`) filtra só por `status`,
  nunca por `published_at <= now()`. "Agendar" hoje não agenda nada.
- `sitemap.xml` usa só `published_at` no `lastmod`; editar o texto de um artigo já
  publicado não muda a data que o buscador vê, então a edição nunca é sinalizada
  para reindexação.
- Não existe feed. Quem quer acompanhar o acervo por um leitor de RSS não tem como.

## Decisões

### Login com Google, allowlist por e-mail

Troca a tela de login padrão do Filament (e-mail/senha) por um botão único
"Entrar com Google" (`Laravel\Socialite`), sem remover a coluna `password` do
modelo `User` — ela só deixa de ter formulário que a leia. `config('admin.email')`
já é, desde a fase 8, o único endereço que o `DatabaseSeeder` registra; ele se torna
também a allowlist: o callback do Google aceita apenas um e-mail verificado que
bata com ele (comparação *case-insensitive*; `google_verified_email` falso recusa
antes de comparar). Qualquer outro e-mail — mesmo autenticado de verdade no
Google — recebe 403 e um `Log::warning`, mesmo padrão do `FallbackController` na
fase 9.

**Por que não `google_id` na tabela de usuários.** Ligar a conta por e-mail é
suficiente para um allowlist de um endereço: criar uma coluna e uma migração para
desambiguar contas que este painel nunca terá é complexidade para um problema que
não existe aqui.

**A página de login é uma `SimplePage` nova, não uma extensão de
`Filament\Auth\Pages\Login`.** A classe padrão carrega formulário de credenciais,
autenticação multifator e rate limiting por tentativa de senha — nada disso se
aplica a um botão único. `content()` devolve só a `Action` que leva à rota de
redirecionamento; o layout, o logo e a moldura continuam os do painel.

### Throttle de API e de login

- `bootstrap/app.php` ganha `$middleware->throttleApi()`, e `AppServiceProvider`
  registra `RateLimiter::for('api', ...)`: 60 requisições por minuto por IP. É o
  limiter que o grupo `api` do Laravel já espera pelo nome — sem registrá-lo, o
  `throttle:api` do grupo lançaria "Rate limiter [api] is not defined" na primeira
  requisição.
- As duas rotas do fluxo Google (`/admin/login/google` e
  `/admin/login/google/callback`) ganham `throttle:10,1` diretamente na definição
  da rota — dez tentativas por minuto por IP, suficiente para uso normal e curto
  o bastante para não valer a pena como superfície de abuso.

### Publicação agendada

`PublicationController::published()` ganha `->where('publications.published_at',
'<=', now())`. É a linha que faltava: sem ela, "Publicado" com data futura já
aparecia. O painel continua mostrando a publicação agendada normalmente — só a
API pública (e, por consequência, o prerender) espera a data chegar.

**Nada chega a `published_at` só de o tempo passar.** O pipeline da fase 9 só
regenera o site quando alguém salva ou apaga uma publicação; uma publicação
agendada não recebe nenhum `save` no instante em que vira elegível. Um comando
novo, `publications:publish-scheduled`, roda a cada minuto pelo `schedule:work` (um
serviço `scheduler` novo no compose, mesma imagem do `queue`) e dispara
`RegenerateSite::dispatch()` quando o número de publicações elegíveis
(`status = published AND published_at <= now()`) **cresceu** desde a última
execução — comparado contra um inteiro em cache, não contra uma janela de tempo:
sobrevive a uma pausa do scheduler sem perder publicações, e não dispara nada na
primeira execução depois de um deploy (a contagem inicial é a própria linha de
base, não uma comparação contra zero).

O painel ganha uma pista visual: "Situação" mostra **Agendado** (não
**Publicado**) quando `status = published` e `published_at` ainda está no
futuro — a mesma coluna, uma cor e um rótulo a mais.

### `updated_at` no `lastmod`

A API expõe `updated_at` por publicação — o maior entre `publications.updated_at`
e o `updated_at` da tradução do idioma pedido, porque editar só o texto (ver a
fase 9: "editar só a tradução também regenera") não toca a linha de `publications`.
`core/sitemap.ts` passa a receber os dois instantes por entrada e usa o mais
recente como `lastmod`. Continua sendo uma data, não um instante — a
especificação de sitemaps não pede mais que isso.

### RSS

`core/rss.ts`, um módulo puro a mais ao lado de `core/sitemap.ts`, gera RSS 2.0 por
idioma a partir das mesmas `PublicationSummary` que a constelação já carrega —
sem segunda consulta, sem novo campo na API. `prerenderPages` devolve `rss:
Record<Locale, string>`; `main.ts` grava em `<DIST>/{locale}/rss.xml`, ao lado do
`sitemap.xml` e do `robots.txt` já existentes. `<title>` e `<description>` do canal
reaproveitam `dictionary.meta`; cada `<item>` leva título, link absoluto, resumo
como descrição e `pubDate` em RFC 822. Sem conteúdo completo no feed — o resumo já
existe, o corpo exigiria decidir se um leitor de RSS também interpreta blocos, e
essa decisão não foi pedida.

## Testes

- Backend: callback aceita o e-mail do allowlist e recusa qualquer outro (403 +
  log); API pública some com publicação agendada e aparece quando `published_at`
  cruza `now()` numa segunda chamada; `publications:publish-scheduled` dispara o
  job só quando a contagem sobe, nunca na primeira execução; `updated_at` do
  endpoint de detalhe reflete a tradução, não só a publicação; `throttle:api`
  aplicado (requisição 61 num minuto recebe 429) e os dois limiters aplicados nas
  rotas do Google.
- Frontend: `core/rss.ts` com um caso por campo do `<item>` e por escape de XML;
  `core/sitemap.ts` escolhe o `lastmod` mais recente entre publicação e edição.

## Fora de escopo

Upload de avatar do Google, múltiplos administradores, 2FA, recuperação de senha
(não há mais senha no fluxo de login), conteúdo completo no RSS, paginação do
RSS, webhooks de publicação.

## Critérios de aceite

1. Um e-mail fora do allowlist nunca entra no painel, mesmo com login Google
   bem-sucedido.
2. Uma publicação com `published_at` no futuro e `status = published` não aparece
   na API pública nem no site antes da data, e aparece — sem intervenção manual —
   depois, em até um minuto.
3. Editar o texto de um artigo já publicado muda o `lastmod` dele no `sitemap.xml`.
4. `/pt/rss.xml` e `/en/rss.xml` existem, validam como RSS 2.0 e trazem o acervo
   publicado naquele idioma.
5. A 61ª requisição à API pública no mesmo minuto, do mesmo IP, recebe 429.

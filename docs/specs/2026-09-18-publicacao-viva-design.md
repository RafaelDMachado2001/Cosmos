# Publicação viva — desenho da fase 9

Estado: aprovado em 18/09/2026. Sucede a fase 8 (backend Laravel, API pública e
painel administrativo).

## O problema

A fase 8 entregou um painel que grava no Postgres e uma API que devolve o que
foi gravado. O que ela não entregou foi o caminho entre o painel e o site:

- `docker/web/default.conf:47` devolve `=404` para rota de artigo que não tenha
  arquivo no disco, e o `@app` que resolveria isso está comentado nas linhas
  50-56;
- o `dist/` é assado na imagem do Nginx (`docker/web/Dockerfile:20`), então nada
  em tempo de execução pode reescrevê-lo;
- `sitemap.xml`, `robots.txt`, as duas homes e o índice do acervo que vive dentro
  de cada artigo nascem todos do mesmo build.

Somados, publicar pelo painel não publica: o endereço do artigo novo responde 404
e nenhum buscador fica sabendo que ele existe. Há ainda um teto silencioso — a
API corta em 100 itens (`PublicationController.php:20`) sem dizer a ninguém que
cortou.

## Decomposição

O trabalho levantado na revisão da fase 8 não cabe numa spec só. Três frentes,
que não se bloqueiam:

| Spec | Escopo | Estado |
|---|---|---|
| A · Publicação viva | Este documento. Pipeline de publicação, escala, CI, resiliência, fronteiras de código, documentação. | fase 9 |
| B · Blocos de leitura | Canvas de design do sistema de blocos, modelo de conteúdo rico, `ArticleBody` único. | fase 10 |
| C · Painel profissional | Login com Google e allowlist, throttle de API e de login, `updated_at` no `lastmod`, publicação agendada, RSS. | fase 11 |

A B e a C ficam para as fases seguintes. O canvas da B não depende desta spec
e pode começar a qualquer momento.

## Decisões

**O disco continua sendo o caminho normal.** Salvar no Filament enfileira um job
que roda o mesmo prerender de sempre e grava no volume que o Nginx serve. O
`@app` cobre apenas a janela entre salvar e o job terminar. A alternativa —
Laravel renderizando toda rota de artigo por Blade — foi recusada porque criaria
uma segunda fonte de verdade do markup, vigiada só por um teste de paridade.

**O `@app` é caminho de exceção, e responde como tal.** Casca mínima, `noindex`,
e um registro de cada acerto: ser alcançado significa que o pipeline falhou, e
isso precisa aparecer em algum lugar. O Laravel não ganha nenhuma lógica de SEO —
`core/seo.ts` continua existindo uma vez só, em TypeScript.

**A constelação continua carregando o acervo inteiro.** Com 500 publicações o
payload resumido fica em torno de 30 KB comprimidos, e busca, filtro e
esmaecimento seguem instantâneos e locais. Janelar por `before` faria o
esmaecimento depender de rede e a régua temporal deixar de conhecer a extensão
real do acervo — os dois sustentam a premissa da linha do tempo presente de uma
vez. O `websearch_to_tsquery` do backend permanece disponível na API, sem
segundo consumidor.

## Arquitetura

### 1. Pipeline de publicação

```
Filament salva publicação
  └─> RegenerateSite (ShouldBeUnique, delay de 5s: colapsa rajada de edições)
        └─> serviço `queue` (mesma imagem do app, comando queue:work)
              └─> node /srv/render/prerender.js
                    DIST=/srv/site  PRERENDER_API_URL=http://web
                    └─> escreve no volume `site`
                          └─> Nginx serve por try_files
```

**O `dist` vira volume.** A imagem `web` guarda o build em `/opt/site`; um
entrypoint o copia para o volume `site` quando a versão difere. O deploy
sobrescreve tudo; o job regrava por cima depois. Sem isso o Nginx serve um
diretório imutável e o job escreve no vazio.

**O runner mora na imagem PHP.** Ela ganha `nodejs` e, por multi-stage, o
`dist-ssr` e os `node_modules` de produção. O serviço `queue` roda `queue:work`
com a mesma imagem, separado do `app` para que um prerender de vinte segundos não
prenda um worker de FPM.

**O job regenera o site inteiro, não um slug.** Toda publicação nova muda as duas
homes, o `404.html`, o `sitemap.xml` e o índice do acervo que vive dentro de cada
artigo já gravado. Um caminho por slug precisaria regravar quase tudo de qualquer
modo, e seria um segundo caminho de código divergindo do build. Com 500
publicações são cerca de mil páginas; a implementação mede esse tempo e só corta
por slug se passar de trinta segundos.

**O prerender passa a ser configurável em tempo de execução.** Hoje `__API_URL__`
é congelado no bundle (`vite.prerender.config.ts:25`) e `DIST` é constante
(`src/prerender/main.ts:22`). Passam a vir de `process.env`, e `prerenderPages`
passa a receber a fonte por parâmetro — o que destrava o job e, de quebra, deixa
os testes do prerender injetarem fixtures em vez de depender do acervo semente.

**A imagem de Open Graph sai de carona.** Gerada no mesmo passo, a partir dos
tokens reais, com nome derivado de um hash de título e idioma: o que não mudou
não é redesenhado. Resolve a lacuna de `og:image`, que hoje não existe em
`core/seo.ts` — todo link compartilhado do site sai sem cartão.

### 2. O fallback `@app`

Reativa as linhas 50-56 de `docker/web/default.conf`. O Laravel responde com uma
Blade enxuta: título, parágrafos, link para a home, `<meta name="robots"
content="noindex">` e um `Log::warning` com o slug pedido. Sem canonical, sem
hreflang, sem Open Graph e sem JSON-LD — afirmar qualquer um deles a partir de
uma segunda implementação é como o canonical errado nasce.

### 3. Contrato da API e escala

- `limit` ganha teto de 1000; a resposta ganha `meta: { count, limit, truncated }`.
- **Acervo truncado não vira site**: o prerender falha o build quando `truncated`
  é verdadeiro. Um site publicado com metade do acervo é pior que um build
  vermelho.
- No cliente, truncamento é aviso de console, não tela: é falha de operação, não
  estado de leitura.
- `App.tsx:136` faz `summaries.find(...)` dentro de `labelFor`, chamado uma vez
  por estrela a cada render — 250 mil comparações por passada com 500
  publicações. Vira `Map` construído uma vez, junto com o mesmo padrão em
  `onHover` e `hoverCard`.
- O limiar de virtualização (800, em `Cosmos.tsx:22`) fica como está: com 500
  estrelas todas seguem no DOM, e é o `content-visibility` que paga a conta.

### 4. Fronteiras de código

- `core/timeline.ts` (505 linhas, três assuntos) → `core/hash.ts` (FNV-1a),
  `core/timeline.ts` (colocação temporal) e `core/geometry.ts` (faixa,
  conectores, anos, limites de pan, janela visível). É a divisão que a suíte já
  assumiu sozinha ao se separar em `timeline.test.ts` e
  `timeline.geometry.test.ts`.
- `hooks/useCosmosEngine.ts` (571 linhas, três papéis) → `core/camera.ts` puro
  (`goHome`, `slideTo`, `jumpTo`, `openStar`, `closeReader` sobre um objeto de
  estado, sem DOM), `hooks/useCosmosInput.ts` (ouvintes, arraste, régua) e o
  motor reduzido a ligar os dois no laço. É onde moram os defeitos de câmera
  desfazendo o recuo que o fechamento promete, e hoje nada disso é testável.
- Vocabulário com fonte única: `npm run emit:seed` passa a emitir também
  `backend/config/publications.php` com idiomas, categorias e dicionários de
  full-text. Hoje a lista de idiomas existe em `core/types.ts`, em
  `PublicationTranslation::LOCALES`, em `PublicationController::DICTIONARY` e no
  `CASE` de uma migration já aplicada. Mesmo precedente do `publications.json`,
  mesma regra do projeto: o acervo — e agora o vocabulário — tem uma fonte só.
- `absolute()` está duplicado em `core/seo.ts:66` e `core/sitemap.ts:23`; vai
  para um módulo comum.

### 5. Resiliência no cliente

`main.tsx:25` remove a casca pré-renderizada antes de o React montar. Se o React
quebrar, o leitor fica com tela preta e o conteúdo que já estava no HTML foi
destruído. Passa a: montar primeiro, remover `#prerender` num efeito depois do
primeiro commit bem-sucedido, e envolver a `Shell` num ErrorBoundary que mantém a
casca e esconde o `#root` quando algo falha. Quem estava lendo continua lendo.

### 6. CI e retaguardas

`ci.yml`, quatro jobs:

| Job | O que roda |
|---|---|
| frontend | `npm run check`, build e prerender contra fixtures |
| backend | Postgres de serviço, `pint --test`, PHPStan nível 8 (Larastan, sem baseline), `artisan test` |
| e2e | Playwright contra o build servido: navegação, histórico, 404 com status real, página sem JavaScript |
| integração | `docker compose --profile backend`, publica pelo Filament e verifica que a URL do artigo responde 200 com o texto |

O job de integração é o que prova a fase inteira de ponta a ponta.

Hooks: pre-commit rápido (apenas o que mudou, mais Pint no backend) e pre-push
com a suíte completa. Hoje o pre-commit roda tudo, e é por isso que `--no-verify`
é tentador.

Validação de ambiente como script chamado no `predev`, no `prebuild` e no CI:
chaves faltando ou sobrando em relação ao `.env.example` e, em produção,
`APP_DEBUG=false`, `APP_KEY` presente, senha de banco não vazia e `VITE_SITE_URL`
absoluta.

Proteção de branch fica **documentada**, com os valores exatos, e não aplicada:
mexer nas configurações do repositório é decisão de quem o administra.

### 7. Documentação

O `README.md` afirma que o backend não existe e que será Laravel 11; ambas
deixaram de ser verdade na fase 8. Reescrito onde mente e acrescido do pipeline
de publicação, do CI e dos hooks, com as decisões desta spec e
as fases 10 e 11 registradas.

## Tratamento de erro

| Falha | Comportamento |
|---|---|
| Job falha ou ainda não terminou | `@app` responde a casca mínima com `noindex`; o acerto é registrado |
| Node indisponível no runner | Job falha e fica na fila com retentativa; o site continua servindo o build anterior |
| API truncando o acervo | Prerender falha o build, antes de publicar site incompleto |
| Erro de runtime no React | ErrorBoundary preserva a casca pré-renderizada |
| Volume `site` vazio no primeiro boot | Entrypoint da imagem `web` copia o build assado em `/opt/site` |

## Testes

- `core/camera.ts`, `core/geometry.ts` e `core/hash.ts`: puros, na suíte que já
  existe.
- `Shell` em jsdom com Testing Library: abrir estrela empilha histórico; voltar
  fecha sem duplo toque; Esc durante a abertura; foco retorna à estrela; carga
  direta em 404 e no outro idioma.
- Escala: 500 e 1000 publicações sintéticas (`src/data/synthetic.ts`), com
  orçamento folgado em `placeStars`, `connectors` e `visibleRange`.
- Contrato: `meta.truncated` verdadeiro derruba o prerender.
- PHP: o job enfileira uma vez por rajada; o fallback responde 200 com `noindex` e
  registra; a paridade do seeder com o acervo semente continua valendo.
- Playwright e o job de integração descritos acima.

## Fora de escopo

Modelo de conteúdo rico e `ArticleBody` compartilhado (spec B). Login com Google,
throttle, publicação agendada, `updated_at` no `lastmod` e RSS (spec C).
Orçamento automático de acessibilidade e de tamanho de bundle — levantado, não
escolhido para este ciclo.

## Riscos

- **Tempo do prerender completo.** Mil páginas por publicação é a aposta que
  sustenta "um caminho de código só". Se a medição desmentir, o corte por slug
  entra — e aí existem dois caminhos para manter.
- **Imagem PHP mais pesada.** Node no container do backend é o preço de não ter
  um quarto serviço. Fica registrado como o primeiro candidato a mudar se o
  deploy apertar.
- **Volume compartilhado entre `web` e `queue`.** Dois escritores no mesmo
  diretório; a gravação precisa ser atômica (arquivo temporário e `rename`) para
  que ninguém sirva HTML pela metade.

## Critérios de aceite

1. Publicar pelo Filament faz a URL do artigo responder 200 com o texto, sem
   rebuild de imagem, e o artigo aparece no `sitemap.xml` e nas duas homes.
2. Um acervo de 500 publicações navega, busca e filtra sem regressão perceptível,
   e nenhuma delas desaparece silenciosamente.
3. Todo link de artigo compartilhado traz cartão com imagem.
4. Uma PR não entra sem CI verde nos quatro jobs.
5. Um erro de runtime no React deixa o leitor com o artigo, não com tela preta.

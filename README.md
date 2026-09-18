# RDM Labs · Cosmos

Experiência web onde publicações — artigos técnicos, estudos, projetos e registros de rotina —
aparecem como uma **constelação temporal** navegável, com um núcleo 3D como portal de entrada.

A especificação de design completa está em `design_handoff_rdm_cosmos/README.md` (cores,
tipografia, medidas, curvas de animação e comportamento de cada tela). O protótipo de referência
está em `design_handoff_rdm_cosmos/prototype/RDM Cosmos.dc.html`.

## Stack

React 18 · TypeScript · Vite · Three.js (puro, sem react-three-fiber) · CSS Modules sobre tokens.
Sem biblioteca de animação: interpolação exponencial (`damp`) e keyframes CSS.
Backend em Laravel 13 + PostgreSQL 18, com painel administrativo em Filament 5.

## Rodando

Todo o desenvolvimento acontece em Docker.

```sh
cp .env.example .env      # ajuste DOCKER_UID/DOCKER_GID com `id -u` e `id -g`
docker compose up node    # dev server em http://localhost:5174
```

| Comando | O que faz |
|---|---|
| `docker compose up node` | Vite com HMR (uso diário) |
| `docker compose up` | Vite + build de produção servido pelo Nginx em `:8080` |
| `docker compose --profile backend up` | Acrescenta Laravel e Postgres |
| `docker compose --profile backend run --rm app php artisan test` | Testes do backend |
| `docker compose run --rm node npm run check` | typecheck + lint + testes |
| `docker compose run --rm node npm run build` | build de cliente + prerender das rotas |
| `docker compose run --rm node npm run test:watch` | testes em watch |

> O Node do host não é usado. Rodar `npm run` direto na máquina pode falhar por diferença de
> versão e por binários de plataforma (`esbuild`, `rollup`) — sempre via `docker compose run`.

## Arquitetura

- **`src/core/`** — TypeScript puro, sem DOM, sem React, sem Three. Posicionamento temporal,
  coeficientes de movimento, máquina de estados da navegação, filtros, rotas e o cabeçalho de
  SEO de cada página. É onde mora quase toda a suíte de testes.
- **`src/prerender/`** — o passo de build que grava uma página HTML por rota. Roda no Node,
  depois do build de cliente, pelo `postbuild` do npm.
- **`src/three/`** — a cena WebGL numa classe própria, com o rAF fora do React.
- **`src/components/`** — um diretório por componente, com o CSS Module ao lado.
- **`src/styles/tokens.css`** — fonte única de verdade das cores. A cena 3D lê estes mesmos
  tokens via `getComputedStyle`, para que CSS e shader nunca divirjam.
- **`src/i18n/`** — `pt.ts` é a fonte de verdade e `en.ts` é tipado contra ele: uma chave
  faltando quebra o typecheck em vez de renderizar vazio.

**Regra que governa o código:** nada que mude por frame passa pelo React. `enter`, `pan` e `zoom`
são refs mutáveis lidos por um único `requestAnimationFrame`, que escreve direto em
`style.transform` e nos uniforms. O React só reage a estado discreto.

## Rotas e SEO

Cada publicação tem um endereço real e traduzido — `/pt/publicacoes/{slug}` e
`/en/publications/{slug}` — reconhecido por `src/core/routing.ts`, que é o dono único desse
mapa. O clique numa estrela empilha uma entrada de histórico; o "×", o Esc e o voltar do
navegador fazem a mesma coisa.

No build, `npm run postbuild` grava um HTML por rota, com `<title>`, `meta description`,
canonical, `hreflang` PT/EN, Open Graph e JSON-LD `Article`, mais `sitemap.xml`, `robots.txt` e
um `404.html`. A casca gravada não é a constelação: é `ArticlePage`/`HomePage`, sem WebGL, que
serve tanto ao rastreador quanto a quem navega sem JavaScript. O React a descarta ao montar.

A origem absoluta vem de `VITE_SITE_URL` e é assada no bundle — trocar de domínio exige rebuild.

## Backend

A API pública e o painel vivem em `backend/`, servidos pelo mesmo Nginx do site.

```sh
cp backend/.env.example backend/.env         # DB_PASSWORD igual ao do .env da raiz
docker compose --profile backend up -d
docker compose --profile backend run --rm app php artisan key:generate
docker compose --profile backend run --rm app php artisan migrate --seed
```

O painel fica em `/admin`. Não há registro público: o único usuário nasce do
`DatabaseSeeder`, com as credenciais de `ADMIN_EMAIL` e `ADMIN_PASSWORD` do
`.env` da raiz — nenhuma credencial é versionada.

| Endpoint | O que devolve |
|---|---|
| `GET /api/publications?locale=&category=&q=&before=&limit=` | Lista enxuta, do mais novo para o mais antigo |
| `GET /api/publications/{slug}?locale=` | Publicação completa, com o corpo em parágrafos |

A busca é `websearch_to_tsquery` sobre uma coluna `tsvector` **gerada**, com os
dicionários `portuguese` e `english` escolhidos pelo `locale` da própria linha —
não há caminho pelo qual um texto entre sem ser indexado. Só publicações com
`status = published` chegam à API.

O acervo semente do backend é gerado do frontend por `npm run emit:seed`: uma
única fonte de conteúdo para os dois lados.

### Trocando o acervo estático pela API

`VITE_API_URL=/` faz a constelação ler da API em vez de `src/data/publications.ts`.
Os dois adapters passam a mesma suíte de contrato, então nada mais muda. O
prerender roda em Node e precisa de um endereço absoluto — daí `PRERENDER_API_URL`.

### Testes do backend

```sh
docker compose --profile backend run --rm app php artisan test
```

Rodam contra Postgres, não SQLite: a busca depende de `tsvector` e de
`websearch_to_tsquery`, que só existem lá. `tests/TestCase.php` recusa a rodar
se o banco configurado não terminar em `_test`.

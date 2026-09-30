# Publicação viva — plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: use `superpowers:subagent-driven-development`
> (recomendado) ou `superpowers:executing-plans` para implementar tarefa a tarefa.
> Os passos usam caixas (`- [ ]`) para acompanhamento.

**Objetivo:** fazer com que salvar uma publicação no Filament faça a URL do artigo
responder 200 com o texto, sem rebuild de imagem, e que o artigo apareça no
`sitemap.xml` e nas duas homes.

**Arquitetura:** o disco continua sendo o caminho normal. Salvar no painel enfileira
um job que roda o mesmo prerender do build e grava num volume que o Nginx serve; o
`@app` cobre só a janela entre salvar e o job terminar. Nenhum markup nasce em Blade
além dessa casca de exceção — `core/seo.ts` continua existindo uma vez só.

**Stack:** TypeScript + React 18 + Vite 5 (frontend), Laravel 13 + Filament 5 + Postgres 16
(backend), Nginx 1.27, Docker Compose, Vitest, PHPUnit, Playwright, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-18-publicacao-viva-design.md` — leia junto.
O plano argumenta a partir dela.

## Restrições globais

Valem para toda tarefa. Os valores são literais da spec e do `CLAUDE.md`.

- **Todo comando roda em Docker.** O Node do host é v18 e falha por binários de
  plataforma. Nunca `npm run` direto na máquina.
  `docker compose run --rm node npm run check` é o gate.
- **Nada que mude por frame passa pelo React.** `enter`, `pan` e `zoom` são refs
  mutáveis lidos por um único `requestAnimationFrame`.
- **Posições de estrela são sempre derivadas** de data + hash FNV-1a do slug. Nunca
  armazenadas, nunca escritas à mão.
- **`src/core/` é TypeScript puro** — sem DOM, sem React, sem Three. Lógica nova
  começa ali, testada, antes de encostar em componente.
- **`src/styles/tokens.css` é a única fonte de verdade das cores.**
- **`src/i18n/pt.ts` é a fonte de verdade do vocabulário**; `en.ts` é tipado contra ele.
- **A constelação é HTML posicionado por transform, nunca canvas.**
- **`StarIndex` nunca é virtualizado.**
- **O acervo tem uma fonte só.** `backend/database/seeders/publications.json` é
  gerado de `src/data/publications.ts` por `npm run emit:seed`.
- **O prerender não renderiza a `Shell`** — só `ArticlePage`/`HomePage`.
- **O Nginx não tem fallback para `/index.html`.** O que não está no disco devolve
  404 de verdade. O `@app` desta fase é a única exceção, e responde `noindex`.
- **A suíte do backend exige banco terminado em `_test`** (`tests/TestCase.php` recusa
  rodar sem isso).
- **Escrita no volume compartilhado é atômica**: arquivo temporário e `rename`, porque
  `web` e `queue` escrevem no mesmo diretório.
- **Todo script de shell é gravado com LF, nunca CRLF.** O repositório está em
  `core.autocrlf=true` e ainda não tem `.gitattributes` (a Tarefa 19 o cria). Um
  `entrypoint.sh` com CRLF faz o container não subir, com
  `bad interpreter: no such file or directory`. Vale já na Tarefa 4.
- **Limite da API:** teto de 1000; `DEFAULT_LIMIT` continua 100.
- **Atraso do job:** 5 segundos, `ShouldBeUnique`.
- **Corte por slug só entra se o prerender completo passar de 30 segundos.**
- **O limiar de virtualização fica em 800** (`src/components/Cosmos/Cosmos.tsx:22`).
  A spec decidiu não mexer: com 500 estrelas todas seguem no DOM e é o
  `content-visibility` que paga a conta. Não "otimizar" isso de passagem.
- **A migration `2026_01_01_000001` fica como está.** O `CASE` dela guarda uma cópia
  congelada do vocabulário; reescrever histórico de migration é pior que a duplicação.

## Estrutura de arquivos

**Criar**

| Arquivo | Responsabilidade |
|---|---|
| `src/core/hash.ts` | FNV-1a, extraído de `timeline.ts` |
| `src/core/geometry.ts` | faixa, conectores, anos, limites de pan, janela visível |
| `src/core/camera.ts` | `goHome`, `slideTo`, `jumpTo`, `openStar`, `closeReader` puros sobre um objeto de estado |
| `src/core/url.ts` | `absolute(origin, path)`, hoje duplicado em `seo.ts` e `sitemap.ts` |
| `src/hooks/useCosmosInput.ts` | ouvintes, arraste, régua |
| `src/components/ErrorBoundary/ErrorBoundary.tsx` | mantém a casca pré-renderizada quando o React quebra |
| `src/prerender/og.ts` | imagem de Open Graph a partir dos tokens |
| `backend/app/Jobs/RegenerateSite.php` | job de regeração |
| `backend/app/Observers/PublicationObserver.php` | dispara o job ao salvar |
| `backend/app/Http/Controllers/FallbackController.php` | casca `@app` com `noindex` |
| `backend/resources/views/fallback.blade.php` | a casca mínima |
| `backend/config/publications.php` | **gerado** por `emit:seed` — idiomas, categorias, dicionários |
| `docker/web/entrypoint.sh` | copia `/opt/site` para o volume quando a versão difere |
| `scripts/check-env.ts` | validação de ambiente |
| `.github/workflows/ci.yml` | quatro jobs |
| `e2e/` | specs Playwright |

**Modificar**

| Arquivo | Mudança |
|---|---|
| `src/prerender/main.ts:22` | `DIST` sai de constante para `process.env` |
| `src/prerender/pages.tsx:61` | `prerenderPages()` passa a receber a fonte por parâmetro |
| `vite.prerender.config.ts:24-27` | `__API_URL__` do prerender em tempo de execução |
| `docker/web/Dockerfile` | `ARG VITE_API_URL`, build em `/opt/site`, entrypoint |
| `docker/web/default.conf:47-57` | reativa `@app` |
| `docker/php/Dockerfile` | ganha `nodejs` e, por multi-stage, `dist-ssr` e `node_modules` de produção |
| `docker-compose.yml` | serviço `queue`, volume `site` |
| `src/main.tsx:25` | remove a casca depois do primeiro commit, não antes |
| `src/App.tsx:136` | `summaries.find` vira `Map` |
| `src/core/timeline.ts` | perde hash e geometria |
| `src/hooks/useCosmosEngine.ts` | reduzido a ligar `camera.ts` e `useCosmosInput.ts` no laço |
| `src/core/seo.ts:66`, `src/core/sitemap.ts:23` | passam a importar `core/url.ts` |
| `backend/app/Http/Controllers/Api/PublicationController.php:20` | teto 1000, `meta` |
| `scripts/emit-seed.ts` | emite também `backend/config/publications.php` |
| `.githooks/pre-commit` | só o que mudou, mais Pint |
| `README.md`, `CLAUDE.md` | pipeline, CI, hooks; corrigir o que mente |

## Fatias

O plano é completo, a execução é fatiada. Cada fatia entrega software que funciona.

Execute em ordem de fatia. A 7 vem antes da 6 porque o job `frontend` do CI roda a
suíte que ela cria.

| Ordem | Fatia | Tarefas | Entrega |
|---|---|---|---|
| 1º | 1 · Pipeline | 1–7 | **Critério de aceite 1.** Publicar pelo painel faz a URL responder 200. |
| 2º | 2 · Contrato e escala | 8–11 | Critério 2. Nenhuma publicação some em silêncio. |
| 3º | 3 · Fronteiras | 12–15 | Código testável; sem mudança de comportamento. |
| 4º | 4 · Resiliência | 16 | Critério 5. |
| 5º | 7 · Cobertura | 22–23 | Os testes que a spec exige e que o CI vai rodar. |
| 6º | 5 · Open Graph | 17 | Critério 3. |
| 7º | 6 · CI e docs | 18–21 | Critério 4. |

**Se for parar em algum ponto, pare no fim da fatia 1.** É a única que precisa das
outras para nada, e é a que resolve o incômodo que originou a fase.

---

# Fatia 1 · Pipeline de publicação

### Tarefa 1: `prerenderPages` recebe a fonte por parâmetro

Hoje `pages.tsx:62` chama `createSource()` por dentro, então o prerender só sabe ler
o que `VITE_API_URL` congelou no bundle, e os testes dependem do acervo semente. O job
precisa injetar uma fonte apontada para a API; os testes passam a injetar fixtures.

**Arquivos:**
- Modificar: `src/prerender/pages.tsx:61-62`
- Teste: `src/prerender/pages.test.ts`

**Interfaces:**
- Consome: `PublicationsSource` e `createStaticSource` de `src/data/PublicationsSource.ts`
- Produz: `prerenderPages(source?: PublicationsSource): Promise<PrerenderOutput>` —
  sem argumento mantém `createSource()`, para o `postbuild` não mudar.

- [ ] **Passo 1: escrever o teste que falha**

Em `src/prerender/pages.test.ts`:

```ts
it('prerenderiza a partir da fonte injetada, nao do acervo semente', async () => {
  const fixture = createStaticSource([
    {
      slug: 'so-esta-publicacao',
      category: 'artigo',
      publishedAt: '2026-01-15T12:00:00.000Z',
      content: {
        pt: { title: 'So esta', summary: 'Resumo.', body: ['Paragrafo.'] },
        en: { title: 'Only this', summary: 'Summary.', body: ['Paragraph.'] },
      },
    },
  ]);

  const { pages } = await prerenderPages(fixture);

  const articles = pages.filter((page) => page.path.includes('/publicacoes/'));
  expect(articles).toHaveLength(1);
  expect(articles[0]?.path).toContain('so-esta-publicacao');
});
```

Acrescente `createStaticSource` ao import de `../data/PublicationsSource`.

- [ ] **Passo 2: rodar e ver falhar**

```sh
docker compose run --rm node npx vitest run src/prerender/pages.test.ts
```

Esperado: FALHA — `prerenderPages` ignora o argumento e devolve as 14 do acervo
semente, então `articles` tem 14 itens, não 1.

- [ ] **Passo 3: implementar o mínimo**

Em `src/prerender/pages.tsx`, trocar a assinatura e remover a primeira linha do corpo:

```tsx
export async function prerenderPages(
  source: PublicationsSource = createSource(),
): Promise<PrerenderOutput> {
  const pages: PrerenderedPage[] = [];
```

Acrescentar o import de tipo:

```tsx
import type { PublicationsSource } from '../data/PublicationsSource';
```

e remover a linha `const source = createSource();`.

- [ ] **Passo 4: rodar e ver passar**

```sh
docker compose run --rm node npx vitest run src/prerender/pages.test.ts
```

Esperado: PASSA, e os 11 testes que já existiam continuam verdes.

- [ ] **Passo 5: commitar**

```sh
git add src/prerender/pages.tsx src/prerender/pages.test.ts
git commit -m "refactor(prerender): injeta a fonte em prerenderPages"
```

---

### Tarefa 2: `DIST` e a URL da API vêm do ambiente

`main.ts:22` fixa `DIST = 'dist'` e `vite.prerender.config.ts:24` congela a URL da API
no bundle do prerender. O job grava em `/srv/site` e lê de `http://web`: os dois
precisam sair de `process.env`.

**Arquivos:**
- Criar: `src/prerender/config.ts`
- Teste: `src/prerender/config.test.ts`
- Modificar: `src/prerender/main.ts:22-23`, `src/prerender/main.ts:93`

**Interfaces:**
- Produz: `distDir(env)`, `templateDir(env)` e `apiUrlFrom(env)` em
  `src/prerender/config.ts`, onde `env` é `Record<string, string | undefined>`.
  Puras, testáveis sem tocar em `process.env`.

**Por que `templateDir` existe.** `main.ts:81` lê o template de
`join(DIST, 'index.html')` e a linha 111 **grava a home composta por cima desse mesmo
arquivo**. No build isso é inofensivo: `vite build` reescreve um `index.html` intocado
antes de cada prerender. No job não: a segunda publicação leria um `index.html` onde o
`SLOT` já foi preenchido, o `includes(SLOT)` falharia e o prerender morreria com
"`<div id="prerender"></div>` não está em /srv/site/index.html". O template passa a vir
de um diretório separado, que no job é o `dist` intocado assado na imagem.

- [ ] **Passo 1: escrever o teste que falha**

Criar `src/prerender/config.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { apiUrlFrom, distDir, templateDir } from './config';

describe('configuracao do prerender', () => {
  it('usa dist quando DIST nao vem do ambiente', () => {
    expect(distDir({})).toBe('dist');
  });

  it('respeita o DIST do ambiente, que e como o job grava no volume', () => {
    expect(distDir({ DIST: '/srv/site' })).toBe('/srv/site');
  });

  it('ignora DIST vazio em vez de gravar na raiz', () => {
    expect(distDir({ DIST: '' })).toBe('dist');
  });

  it('le o template do proprio DIST quando TEMPLATE_DIR nao vem: e o caso do build', () => {
    expect(templateDir({ DIST: '/srv/site' })).toBe('/srv/site');
  });

  it('separa template de destino, que e o que impede o job de se envenenar', () => {
    // O prerender grava a home composta por cima de <DIST>/index.html. Se o
    // template viesse de la, a segunda publicacao leria um arquivo cujo SLOT ja
    // foi preenchido e morreria.
    expect(templateDir({ DIST: '/srv/site', TEMPLATE_DIR: '/srv/render/dist-ssr' })).toBe(
      '/srv/render/dist-ssr',
    );
  });

  it('prefere PRERENDER_API_URL a VITE_API_URL', () => {
    expect(apiUrlFrom({ PRERENDER_API_URL: 'http://web', VITE_API_URL: '/' })).toBe('http://web');
  });

  it('trata / como ausencia: em Node nao ha mesma origem', () => {
    expect(apiUrlFrom({ VITE_API_URL: '/' })).toBeNull();
  });

  it('remove a barra final para nao gerar // na URL montada', () => {
    expect(apiUrlFrom({ PRERENDER_API_URL: 'http://web/' })).toBe('http://web');
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

```sh
docker compose run --rm node npx vitest run src/prerender/config.test.ts
```

Esperado: FALHA — `Cannot find module './config'`.

- [ ] **Passo 3: implementar o mínimo**

Criar `src/prerender/config.ts`:

```ts
/**
 * De onde o prerender le e onde ele grava.
 *
 * Eram constantes: `DIST` em `main.ts` e a URL da API congelada no bundle por
 * `vite.prerender.config.ts`. O job da fase 9 roda o mesmo prerender apontado
 * para outro diretorio e para outro endereco, entao os dois passam a vir do
 * ambiente. Puras e separadas para serem testaveis sem mexer em `process.env`.
 */

type Env = Record<string, string | undefined>;

export function distDir(env: Env): string {
  const configured = env.DIST;
  return configured === undefined || configured === '' ? 'dist' : configured;
}

/**
 * De onde vem o `index.html` que serve de molde.
 *
 * O prerender grava a home composta por cima de `<DIST>/index.html`. No build
 * isso e inofensivo porque o `vite build` reescreve um arquivo intocado antes
 * de cada passada. No job nao: sem separar os dois, a segunda publicacao leria
 * um molde cujo SLOT ja foi preenchido e o prerender morreria. Por padrao segue
 * o DIST, que e exatamente o comportamento de hoje.
 */
export function templateDir(env: Env): string {
  const configured = env.TEMPLATE_DIR;
  return configured === undefined || configured === '' ? distDir(env) : configured;
}

/**
 * Em Node nao existe "mesma origem": `/` nao tem contra o que resolver, entao
 * vale como ausencia e o prerender cai no acervo semente.
 */
export function apiUrlFrom(env: Env): string | null {
  const configured = env.PRERENDER_API_URL ?? env.VITE_API_URL;
  if (configured === undefined || configured === '' || configured === '/') return null;
  return configured.replace(/\/+$/, '');
}
```

- [ ] **Passo 4: rodar e ver passar**

```sh
docker compose run --rm node npx vitest run src/prerender/config.test.ts
```

Esperado: PASSA, 8 testes.

- [ ] **Passo 5: ligar em `main.ts`**

Em `src/prerender/main.ts`, substituir a linha 22 e acrescentar os imports:

```ts
import { PUBLICATIONS } from '../data/publications';
import { createHttpSource, createStaticSource } from '../data/PublicationsSource';
import { apiUrlFrom, distDir, templateDir } from './config';

const DIST = distDir(process.env);
const TEMPLATE_DIR = templateDir(process.env);
```

`SSR_DIR` continua constante: é onde o próprio bundle do prerender mora, não onde o
site sai.

Ainda em `main()`, a leitura do molde passa a usar `TEMPLATE_DIR` — as três referências
a `DIST` nas linhas 81, 86 e 89 são do molde, não do destino:

```ts
  const template = await readFile(join(TEMPLATE_DIR, 'index.html'), 'utf8');

  if (!template.includes(SLOT)) {
    throw new Error(`${SLOT} não está em ${TEMPLATE_DIR}/index.html — nada a preencher.`);
  }
  if (!template.includes('</head>')) {
    throw new Error(`${TEMPLATE_DIR}/index.html sem </head> — não há onde pôr o cabeçalho.`);
  }
```

Todas as escritas (`join(DIST, ...)`) continuam em `DIST`.

- [ ] **Passo 5b: gravar o molde intocado ao lado do bundle**

Medido: depois de `npm run build`, `dist/index.html` tem ~8,9 KB e o `SLOT` **já está
preenchido** — o `postbuild` compõe a home por cima dele (linha 111). Logo o `dist`
assado na imagem não é molde nenhum, e o job morreria já na primeira publicação.

O molde passa a viajar em `dist-ssr/`, que a Tarefa 5 copia para a imagem e que o Nginx
nunca serve — deixá-lo em `dist/` o exporia como uma página de casca vazia, que é o
soft-404 que a fase 6 eliminou.

Em `src/prerender/main.ts`, logo depois das duas validações do molde:

```ts
  /*
   * O molde, intocado, ao lado do bundle.
   *
   * A linha que grava a raiz compoe por cima de <DIST>/index.html, entao o
   * proprio destino deixa de servir de molde depois da primeira passada. O job
   * da fase 9 roda este mesmo prerender a cada publicacao: sem esta copia ele
   * leria um SLOT ja preenchido e morreria. Fica em dist-ssr porque o Nginx
   * nao serve esse diretorio.
   */
  await write(join(SSR_DIR, 'template.html'), template);
```

E a leitura passa a preferir o molde quando ele existe:

```ts
async function readTemplate(): Promise<string> {
  const sidecar = join(TEMPLATE_DIR, 'template.html');
  try {
    return await readFile(sidecar, 'utf8');
  } catch {
    // Primeira passada de um build novo: so existe o index.html que o Vite
    // acabou de emitir, e ele ainda esta intocado.
    return await readFile(join(TEMPLATE_DIR, 'index.html'), 'utf8');
  }
}
```

Trocar a linha 81 por `const template = await readTemplate();`.

- [ ] **Passo 6: ligar a fonte no `main.ts`**

Substituir a linha 93 de `src/prerender/main.ts`:

```ts
  const apiUrl = apiUrlFrom(process.env);
  const source = apiUrl === null ? createStaticSource(PUBLICATIONS) : createHttpSource(apiUrl);
  const { pages, notFound, sitemap, robots } = await prerenderPages(source);
```

Isto tira a decisão de `__API_URL__`, que é de tempo de compilação, e a põe em tempo
de execução — que é o que destrava o job.

- [ ] **Passo 6b: tornar a escrita atômica**

`web` e `queue` passam a escrever no mesmo diretório. `writeFile` direto pode ser lido
pela metade, e um HTML truncado servido com 200 é pior que um 404. Substituir `write`
em `src/prerender/main.ts:75`:

```ts
import { randomUUID } from 'node:crypto';
import { rename } from 'node:fs/promises';

/**
 * Grava por arquivo temporario e `rename`.
 *
 * O volume `site` tem dois escritores — o entrypoint do Nginx e o job — e
 * `rename` no mesmo sistema de arquivos e atomico: quem le ou pega o arquivo
 * antigo inteiro, ou o novo inteiro, nunca meio HTML com 200.
 *
 * O sufixo e aleatorio e nao o PID: cada container tem namespace de PID
 * proprio, entao os dois escritores podem ambos ser o PID 1 e calcular o mesmo
 * nome temporario — que e exatamente a colisao que este write existe para
 * evitar.
 */
async function write(path: string, contents: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, contents, 'utf8');
  await rename(temporary, path);
}
```

- [ ] **Passo 7: rodar o build inteiro e conferir que nada mudou**

```sh
docker compose run --rm node npm run build
```

Esperado: `prerender: 30 páginas, 404.html, sitemap.xml e robots.txt em dist/`. O
número continua 30 porque sem `PRERENDER_API_URL` a fonte segue sendo a semente.

- [ ] **Passo 8: conferir que o `DIST` do ambiente é obedecido**

```sh
docker compose run --rm -e DIST=/tmp/site-teste node sh -c "npm run build && ls /tmp/site-teste/pt/publicacoes | head -3"
```

Esperado: os diretórios dos artigos aparecem em `/tmp/site-teste`.

- [ ] **Passo 9: provar que rodar duas vezes no mesmo destino não envenena o molde**

É a regressão que `templateDir` existe para impedir, e é o que o job faz a cada
publicação.

```sh
docker compose run --rm node sh -c "npm run build \
  && DIST=/tmp/site2 TEMPLATE_DIR=dist-ssr node dist-ssr/prerender.js \
  && DIST=/tmp/site2 TEMPLATE_DIR=dist-ssr node dist-ssr/prerender.js \
  && echo DUAS-PASSADAS-OK"
```

Esperado: `DUAS-PASSADAS-OK`.

`TEMPLATE_DIR=dist-ssr`, e não `dist`: depois do `npm run build` o `dist/index.html`
já é a home composta, e apontar o molde para lá falharia **na primeira** passada. É
exatamente o defeito que o Passo 5b corrige — e a primeira versão desta verificação,
que apontava para `dist`, o escondia.

Confirme também que sem o molde a coisa quebra, para saber que o teste tem dente:

```sh
docker compose run --rm node sh -c "npm run build \
  && DIST=/tmp/site3 TEMPLATE_DIR=dist node dist-ssr/prerender.js" ; echo "saiu $?"
```

Esperado: falha, com a mensagem de que o `SLOT` não está em `dist/index.html`.

- [ ] **Passo 10: commitar**

```sh
git add src/prerender/config.ts src/prerender/config.test.ts src/prerender/main.ts
git commit -m "feat(prerender): DIST e URL da API em tempo de execucao"
```

---

### Tarefa 3: o bundle de produção passa a ler a API

Achado fora da spec, confirmado em execução: `.env` está no `.dockerignore`, então no
build da imagem `web` o `loadEnv` não encontra `VITE_API_URL`, `__API_URL__` vira
`null` e **o bundle embute o acervo semente**. Não há nenhuma string
`/api/publications` no JS publicado hoje.

Sem isto a fase 9 fica pela metade: o job regravaria o disco com 15 artigos, o Nginx
serviria esse HTML, e o React montaria por cima lendo a semente e renderizaria 14.

`VITE_API_URL=/` é correto para qualquer domínio porque é relativo à origem, e é a
mesma origem que serve `/api`.

**Arquivos:**
- Modificar: `docker/web/Dockerfile`

- [ ] **Passo 1: registrar o estado atual como linha de base**

```sh
docker compose exec -T web sh -c "grep -c api/publications /usr/share/nginx/html/assets/index-*.js || true"
```

Esperado: `0`. É o defeito.

- [ ] **Passo 2: acrescentar o build arg**

Em `docker/web/Dockerfile`, logo depois do bloco de `VITE_SITE_URL`:

```dockerfile
# O bundle de cliente precisa falar com a API, senao serve o acervo semente
# embutido e desfaz, ao montar, o que o job de regeracao acabou de gravar.
# Relativo a origem de proposito: vale para qualquer dominio, e e a mesma
# origem que serve /api.
ARG VITE_API_URL=/
ENV VITE_API_URL=${VITE_API_URL}
```

`PRERENDER_API_URL` **não** é passada aqui: durante o build da imagem não há API no
ar, e `apiUrlFrom` trata `/` como ausência, então o build assado usa a semente. É o
comportamento correto para o site que nasce com a imagem; o job regrava depois.

- [ ] **Passo 3: rebuildar e conferir que o bundle mudou**

```sh
docker compose build web && docker compose up -d web
docker compose exec -T web sh -c "grep -c api/publications /usr/share/nginx/html/assets/index-*.js"
```

Esperado: um número maior que zero.

- [ ] **Passo 4: conferir que o prerender do build continuou na semente**

```sh
docker compose exec -T web sh -c "ls /usr/share/nginx/html/pt/publicacoes | wc -l"
```

Esperado: 14 — o build não alcança a API e não deve tentar.

- [ ] **Passo 5: commitar**

```sh
git add docker/web/Dockerfile
git commit -m "fix(web): bundle de producao passa a ler a API, nao o acervo semente"
```

---

### Tarefa 4: o `dist` vira volume

A imagem `web` copia `dist` para `/usr/share/nginx/html`, que é imutável em tempo de
execução. O job precisa de um diretório gravável que o Nginx sirva. A imagem passa a
guardar o build em `/opt/site` e um entrypoint o copia para o volume quando a versão
difere — sem isso o Nginx serviria um volume vazio no primeiro boot.

**Arquivos:**
- Criar: `docker/web/entrypoint.sh`
- Modificar: `docker/web/Dockerfile`, `docker/web/default.conf:5`, `docker-compose.yml`

- [ ] **Passo 1: escrever o entrypoint**

Criar `docker/web/entrypoint.sh` (LF, nunca CRLF — ver Restrições globais):

```sh
#!/bin/sh
# Semeia o volume `site` com o build assado na imagem.
#
# O volume nasce vazio no primeiro boot e o job so grava quando alguem publica:
# sem esta copia o Nginx serviria 404 em tudo ate a primeira publicacao. A marca
# de versao evita recopiar a cada restart e, num deploy, faz a imagem nova
# sobrescrever o que o job havia gravado — que e o comportamento desejado: o job
# regrava por cima depois.
set -e

# Sem isto, um SITE_DIR vazio faria o `cp` abaixo despejar o site sobre a raiz
# do container. O ENV do Dockerfile ja garante o valor; a asercao existe para a
# falha ser alta e imediata caso alguem o sobrescreva no compose.
: "${SITE_DIR:?SITE_DIR nao definido}"

# A marca NAO e o .build-id que vem dentro de /opt/site: aquele e copiado junto
# com todo o resto, entao um `cp` interrompido podia deixar a marca no lugar com
# metade dos arquivos faltando — e, marcada, a semeadura nunca mais tentaria de
# novo. Esta marca e escrita por ultimo, so depois de a copia terminar.
STAMP="$SITE_DIR/.seed-complete"
BUILD_ID="$(cat /opt/site/.build-id)"

if [ ! -f "$STAMP" ] || [ "$(cat "$STAMP")" != "$BUILD_ID" ]; then
  echo "entrypoint: semeando $SITE_DIR com o build $BUILD_ID"
  # Esvaziar antes de copiar: `cp` sobrescreve mas nunca apaga, e um artigo
  # despublicado que sobrevivesse no volume continuaria respondendo 200 —
  # exatamente o soft-404 que a fase 6 eliminou ao tirar o fallback do Nginx.
  # O deploy sobrescreve tudo por decisao da spec; o job regrava por cima.
  find "$SITE_DIR" -mindepth 1 -delete
  cp -a /opt/site/. "$SITE_DIR/"
  printf '%s\n' "$BUILD_ID" > "$STAMP"
fi

exec "$@"
```

- [ ] **Passo 2: mudar o Dockerfile**

Em `docker/web/Dockerfile`, substituir o estágio final inteiro:

```dockerfile
FROM nginx:1.27-alpine-slim AS web

# O mesmo uid do servico `queue`.
#
# Este container semeia o volume, mas quem escreve nele depois e o job, que roda
# como uid 1000. `cp -a` preserva o dono da origem: sem estes chown o volume
# nasce inteiro como root e a primeira publicacao morre com EACCES. O Nginx le
# como root e nao se importa com o dono.
ARG UID=1000
ARG GID=1000

COPY docker/web/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build --chown=${UID}:${GID} /app/dist /opt/site
COPY docker/web/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh \
 && date -u +%Y%m%d%H%M%S > /opt/site/.build-id \
 && chown ${UID}:${GID} /opt/site/.build-id \
 # O ponto de montagem tambem: o Docker semeia o dono do volume a partir dele,
 # e criar arquivo novo na raiz de /srv/site exige permissao neste diretorio,
 # nao so nos que o `cp` trouxe.
 && mkdir -p /srv/site \
 && chown ${UID}:${GID} /srv/site
ENV SITE_DIR=/srv/site
EXPOSE 80
ENTRYPOINT ["/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
```

E no `docker-compose.yml`, o serviço `web` passa a receber os mesmos args que o `app`
e o `queue` já recebem:

```yaml
      args:
        VITE_SITE_URL: ${VITE_SITE_URL:-http://localhost:8080}
        UID: ${DOCKER_UID:-1000}
        GID: ${DOCKER_GID:-1000}
```

- [ ] **Passo 3: apontar o Nginx para o volume**

Em `docker/web/default.conf`, linha 5, trocar `root /usr/share/nginx/html;` por:

```nginx
    root /srv/site;
```

- [ ] **Passo 4: declarar o volume no compose**

Em `docker-compose.yml`, no serviço `web`, acrescentar ao bloco `volumes`:

```yaml
      - site:/srv/site
```

e ao mapa `volumes` de nível raiz, junto de `node_modules` e `postgres`:

```yaml
  site:
```

- [ ] **Passo 5: subir e conferir que o site continua inteiro**

```sh
docker compose build web && docker compose up -d web
for u in /pt /pt/publicacoes/arquitetura-e-orquestracao-de-llms /rota-que-nao-existe; do
  printf "%-50s" "$u"; curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:8080$u"
done
```

Esperado: `200`, `200`, `404`. O 404 continua real — é o que a fase 6 comprou.

- [ ] **Passo 6: conferir que o volume é gravável**

```sh
docker compose exec -T web sh -c "touch /srv/site/.escrita-teste && echo gravavel && rm /srv/site/.escrita-teste"
```

Esperado: `gravavel`.

- [ ] **Passo 7: commitar**

```sh
git add docker/web/Dockerfile docker/web/entrypoint.sh docker/web/default.conf docker-compose.yml
git commit -m "feat(web): dist vira volume gravavel, semeado pelo entrypoint"
```

---

### Tarefa 5: o runner mora na imagem PHP, e o `queue` roda separado

O job precisa de Node para rodar `dist-ssr/prerender.js`. A imagem PHP ganha `nodejs`
e, por multi-stage, o `dist-ssr` e os `node_modules` de produção. O serviço `queue`
usa a mesma imagem com outro comando, separado do `app` para que um prerender de vinte
segundos não prenda um worker de FPM.

**Arquivos:**
- Modificar: `docker/php/Dockerfile`, `docker-compose.yml`, `backend/.env`

- [ ] **Passo 1: acrescentar o estágio de build do runner**

No topo de `docker/php/Dockerfile`, antes do `FROM php:8.3-fpm-alpine`:

```dockerfile
# O runner do prerender. Mesma origem do build do `web`: um segundo caminho de
# compilacao divergiria do primeiro no primeiro ajuste.
FROM node:22-alpine AS runner
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build
```

- [ ] **Passo 2: trazer Node e o runner para a imagem final**

No estágio PHP de `docker/php/Dockerfile`, depois da linha do Composer:

```dockerfile
# Node no container do backend e o preco de nao ter um quarto servico. Fica
# registrado na spec como o primeiro candidato a mudar se o deploy apertar.
RUN apk add --no-cache nodejs

COPY --from=runner /app/dist-ssr /srv/render/dist-ssr
COPY --from=runner /app/node_modules /srv/render/node_modules
```

**O `dist` não vem.** Uma versão anterior deste plano o copiava, justificando que a
Tarefa 4 semeia o volume a partir dele — o que está errado: a Tarefa 4 semeia do
`/opt/site` da imagem **web**, que é outro build. O job não toca `/srv/render/dist` em
nenhum caminho: lê o molde de `dist-ssr/template.html`, o CSS estático de `dist-ssr/`,
e escreve em `DIST`, que é o volume. Copiá-lo era um bundle inteiro de peso morto em
toda imagem do backend.

O molde intocado é `dist-ssr/template.html`, gravado pelo Passo 5b da Tarefa 2 — por
isso o job aponta `TEMPLATE_DIR` para `/srv/render/dist-ssr`.

O `COPY --from` grava como root e o serviço roda como uid 1000. O prerender **escreve**
em `dist-ssr` (reescreve o molde a cada passada), então o diretório precisa pertencer
ao usuário:

```dockerfile
RUN chown -R app:app /srv/render/dist-ssr
```

Vai depois do bloco `adduser`, que é quem cria o usuário.

- [ ] **Passo 3: declarar o serviço `queue` no compose**

Em `docker-compose.yml`, depois do serviço `app`:

```yaml
  ### Worker de fila: roda o prerender fora do ciclo de request ###############
  queue:
    build:
      context: .
      dockerfile: docker/php/Dockerfile
      args:
        UID: ${DOCKER_UID:-1000}
        GID: ${DOCKER_GID:-1000}
    profiles: [backend]
    user: "${DOCKER_UID:-1000}:${DOCKER_GID:-1000}"
    working_dir: /var/www
    command: php artisan queue:work --tries=3 --timeout=180
    volumes:
      - ./backend:/var/www
      - site:/srv/site
    environment:
      - DB_CONNECTION=pgsql
      - DB_HOST=db
      - DB_PORT=5432
      - DB_USERNAME=${DB_USERNAME:-rdm}
      - DB_PASSWORD=${DB_PASSWORD}
      # O prerender roda em Node: precisa de endereco absoluto, e dentro da
      # rede do compose a API atende pelo nome do servico.
      - PRERENDER_API_URL=http://web
      - SITE_DIR=/srv/site
      - TZ=${TIMEZONE:-America/Sao_Paulo}
    depends_on:
      db:
        condition: service_healthy
    networks:
      - rdm-network
    restart: unless-stopped
```

- [ ] **Passo 4: pôr a fila no banco**

Em `backend/.env`, trocar `QUEUE_CONNECTION` para `database`. A tabela `jobs` já existe
— foi criada pela migration `0001_01_01_000002_create_jobs_table`.

- [ ] **Passo 5: conferir que o runner funciona dentro da imagem PHP**

```sh
docker compose --profile backend build queue
docker compose --profile backend run --rm \
  -e DIST=/tmp/prova -e TEMPLATE_DIR=/srv/render/dist-ssr queue \
  sh -c "cd /srv/render && node dist-ssr/prerender.js && ls /tmp/prova/pt/publicacoes | wc -l"
```

O `TEMPLATE_DIR` é obrigatório aqui: sem ele o `templateDir` recai no próprio `DIST`,
que neste comando é um diretório vazio, e o prerender morre sem molde. É a mesma
separação que a Tarefa 2 introduziu, e é o que o job faz em produção.

Esperado: o prerender roda e imprime a contagem de artigos. Com `PRERENDER_API_URL`
apontando para `web`, deve vir o que estiver no banco.

- [ ] **Passo 6: commitar**

```sh
git add docker/php/Dockerfile docker-compose.yml backend/.env.example
git commit -m "feat(queue): runner de prerender na imagem PHP e servico de fila"
```

---

### Tarefa 6: o job de regeração, disparado ao salvar

**Arquivos:**
- Criar: `backend/app/Jobs/RegenerateSite.php`
- Criar: `backend/app/Observers/PublicationObserver.php`
- Criar: `backend/tests/Feature/RegenerateSiteTest.php`
- Modificar: `backend/app/Providers/AppServiceProvider.php`

**Interfaces:**
- Produz: `RegenerateSite implements ShouldQueue, ShouldBeUnique`, com
  `public int $uniqueFor = 60` e `$delay = 5`. O observer chama
  `RegenerateSite::dispatch()` em `saved` e `deleted`.

- [ ] **Passo 1: escrever o teste que falha**

Criar `backend/tests/Feature/RegenerateSiteTest.php`:

```php
<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Jobs\RegenerateSite;
use App\Models\Publication;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class RegenerateSiteTest extends TestCase
{
    use RefreshDatabase;

    public function test_salvar_uma_publicacao_enfileira_a_regeracao(): void
    {
        Queue::fake();

        Publication::create([
            'slug' => 'publicacao-de-teste',
            'category' => 'artigo',
            'published_at' => now(),
            'featured' => false,
            'status' => Publication::STATUS_PUBLISHED,
        ]);

        Queue::assertPushed(RegenerateSite::class);
    }

    public function test_uma_rajada_de_edicoes_colapsa_num_job_so(): void
    {
        Queue::fake();

        $publication = Publication::create([
            'slug' => 'publicacao-editada',
            'category' => 'artigo',
            'published_at' => now(),
            'featured' => false,
            'status' => Publication::STATUS_DRAFT,
        ]);
        $publication->update(['status' => Publication::STATUS_PUBLISHED]);
        $publication->update(['featured' => true]);

        // Tres escritas, um job. E o mecanismo central da fase: quem esta
        // escrevendo no painel salva varias vezes seguidas, e cada salvamento
        // custaria um prerender de um minuto se ShouldBeUnique nao colapsasse
        // a rajada. Nao libere a trava aqui — liberar apaga justamente a prova.
        Queue::assertPushed(RegenerateSite::class, 1);
    }

    public function test_o_observer_dispara_em_toda_escrita_e_nao_so_na_criacao(): void
    {
        $queue = Queue::fake();

        $publication = Publication::create([
            'slug' => 'publicacao-reeditada',
            'category' => 'artigo',
            'published_at' => now(),
            'featured' => false,
            'status' => Publication::STATUS_DRAFT,
        ]);
        // A trava e liberada de proposito: aqui o que se mede e o observer, nao
        // a deduplicacao. O teste acima e quem cobre a deduplicacao.
        $queue->releaseUniqueJobLocks();
        $publication->update(['status' => Publication::STATUS_PUBLISHED]);
        $queue->releaseUniqueJobLocks();
        $publication->update(['featured' => true]);

        Queue::assertPushed(RegenerateSite::class, 3);
    }

    public function test_apagar_uma_publicacao_tambem_regenera(): void
    {
        $publication = Publication::create([
            'slug' => 'publicacao-apagada',
            'category' => 'artigo',
            'published_at' => now(),
            'featured' => false,
            'status' => Publication::STATUS_PUBLISHED,
        ]);

        // Depois da criacao: interessa o dispatch do delete, nao o dela.
        $queue = Queue::fake();
        $publication->delete();

        Queue::assertPushed(RegenerateSite::class);
    }

    public function test_editar_so_a_traducao_tambem_regenera(): void
    {
        $publication = Publication::create([
            'slug' => 'publicacao-traduzida',
            'category' => 'artigo',
            'published_at' => now(),
            'featured' => false,
            'status' => Publication::STATUS_PUBLISHED,
        ]);
        $translation = $publication->translations()->create([
            'locale' => 'pt',
            'title' => 'Titulo original',
            'summary' => 'Resumo.',
            'body' => 'Texto.',
        ]);

        // Um ajuste de titulo nao encosta na linha de `publications`, entao so
        // o observer de PublicationTranslation o pega. E a metade menos obvia
        // da fiacao, e a que regride em silencio.
        $queue = Queue::fake();
        $translation->update(['title' => 'Titulo corrigido']);

        Queue::assertPushed(RegenerateSite::class);
    }

    public function test_apagar_a_traducao_tambem_regenera(): void
    {
        $publication = Publication::create([
            'slug' => 'publicacao-sem-traducao',
            'category' => 'artigo',
            'published_at' => now(),
            'featured' => false,
            'status' => Publication::STATUS_PUBLISHED,
        ]);
        $translation = $publication->translations()->create([
            'locale' => 'en',
            'title' => 'Title',
            'summary' => 'Summary.',
            'body' => 'Text.',
        ]);

        $queue = Queue::fake();
        $translation->delete();

        Queue::assertPushed(RegenerateSite::class);
    }
}
```

- [ ] **Passo 2: rodar e ver falhar**

```sh
docker compose --profile backend exec -T app php artisan test --filter=RegenerateSiteTest
```

Esperado: FALHA — `Class "App\Jobs\RegenerateSite" not found`.

- [ ] **Passo 3: escrever o job**

Criar `backend/app/Jobs/RegenerateSite.php`:

```php
<?php

declare(strict_types=1);

namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use Symfony\Component\Process\Process;

/**
 * Regenera o site inteiro, nao um slug.
 *
 * Toda publicacao nova muda as duas homes, o 404, o sitemap e o indice do
 * acervo que vive dentro de cada artigo ja gravado. Um caminho por slug
 * precisaria regravar quase tudo de qualquer modo, e seria um segundo caminho
 * de codigo divergindo do build.
 */
class RegenerateSite implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    /**
     * Colapsa a rajada de edicoes de quem esta escrevendo no painel.
     *
     * Atribuido no construtor, e nao como propriedade tipada: `Queueable` ja
     * declara `$delay`, e redeclara-la aqui e erro fatal neste PHP/Laravel.
     */
    public function __construct()
    {
        $this->delay = 5;
    }

    /** Depois disto a trava cai, mesmo que o job tenha morrido sem soltar. */
    public int $uniqueFor = 300;

    public int $timeout = 180;

    /**
     * O timeout do processo e menor que o do job de proposito.
     *
     * Iguais, a corrida e entre o `Process` expirar educadamente — logando
     * stderr e o tempo decorrido — e o worker matar o PHP por cima dele. Se o
     * worker ganha, o `node` filho pode ficar orfao escrevendo em /srv/site
     * enquanto a retentativa ja comecou, e o log nao tem nada alem da excecao
     * generica. Esta folga garante que quem expira primeiro e quem sabe
     * explicar por que.
     */
    private const PROCESS_TIMEOUT = 150;

    public function handle(): void
    {
        $started = microtime(true);

        $process = new Process(
            ['node', 'dist-ssr/prerender.js'],
            '/srv/render',
            [
                'DIST' => config('publishing.site_dir'),
                // O molde vem da copia intocada assada na imagem, nunca do
                // destino: o prerender grava a home por cima de
                // <DIST>/index.html, e ler dali envenenaria a proxima passada.
                'TEMPLATE_DIR' => config('publishing.template_dir'),
                'PRERENDER_API_URL' => config('publishing.api_url'),
                'VITE_SITE_URL' => config('app.url'),
            ],
            null,
            self::PROCESS_TIMEOUT,
        );

        /*
         * O try existe porque `run()` lanca antes de `isSuccessful()` em dois
         * casos que interessam: timeout e erro de infraestrutura (cwd que nao
         * existe, binario ausente). Sem ele, justamente a falha mais provavel
         * quando isto rodar desacompanhado seria a que sai com o pior
         * diagnostico — a excecao generica do Laravel, sem stderr nem tempo.
         */
        try {
            $process->run();
        } catch (\Throwable $exception) {
            Log::error('RegenerateSite nao chegou a terminar', [
                'motivo' => $exception->getMessage(),
                'saida' => $process->getErrorOutput(),
                'segundos' => round(microtime(true) - $started, 1),
            ]);

            throw $exception;
        }

        $seconds = round(microtime(true) - $started, 1);

        if (! $process->isSuccessful()) {
            Log::error('RegenerateSite falhou', [
                'saida' => $process->getErrorOutput(),
                'segundos' => $seconds,
            ]);

            throw new \RuntimeException('prerender falhou: '.$process->getErrorOutput());
        }

        // O tempo vai para o log porque a spec condiciona o corte por slug a
        // ele: se a regeracao completa passar de trinta segundos, o caminho
        // por slug entra. A medicao
        // mora aqui para que a decisao seja tomada com numero, nao com palpite.
        Log::info('RegenerateSite concluido', [
            'segundos' => $seconds,
            'saida' => trim($process->getOutput()),
        ]);
    }
}
```

- [ ] **Passo 4: criar a configuração que o job lê**

Criar `backend/config/publishing.php`:

```php
<?php

declare(strict_types=1);

return [
    'site_dir' => env('SITE_DIR', '/srv/site'),
    // dist-ssr e nao dist: dist/index.html e a home composta depois do
    // postbuild. O molde intocado e dist-ssr/template.html. Ver Tarefa 2.
    'template_dir' => env('TEMPLATE_DIR', '/srv/render/dist-ssr'),
    'api_url' => env('PRERENDER_API_URL', 'http://web'),
];
```

- [ ] **Passo 5: escrever o observer**

Criar `backend/app/Observers/PublicationObserver.php`:

```php
<?php

declare(strict_types=1);

namespace App\Observers;

use App\Jobs\RegenerateSite;
use App\Models\Publication;

/**
 * Publicar pelo painel tem de chegar ao disco.
 *
 * `saved` cobre criacao e edicao; `deleted` existe porque despublicar tambem
 * muda o site — e um artigo que sumiu do banco mas continua no disco e pior
 * que um que nunca chegou la.
 */
class PublicationObserver
{
    public function saved(Publication $publication): void
    {
        RegenerateSite::dispatch();
    }

    public function deleted(Publication $publication): void
    {
        RegenerateSite::dispatch();
    }
}
```

- [ ] **Passo 6: registrar o observer**

Em `backend/app/Providers/AppServiceProvider.php`, no método `boot()`:

```php
use App\Models\Publication;
use App\Observers\PublicationObserver;

// ...

public function boot(): void
{
    Publication::observe(PublicationObserver::class);
}
```

A tradução também precisa disparar: salvar só o texto, sem tocar na publicação, não
passa pelo observer acima. Registre o mesmo efeito em `PublicationTranslation`:

```php
use App\Models\PublicationTranslation;

PublicationTranslation::saved(static fn () => RegenerateSite::dispatch());
PublicationTranslation::deleted(static fn () => RegenerateSite::dispatch());
```

- [ ] **Passo 7: rodar e ver passar**

```sh
docker compose --profile backend exec -T app php artisan test --filter=RegenerateSiteTest
```

Esperado: PASSA, 2 testes.

- [ ] **Passo 8: a prova de ponta a ponta, que é o critério de aceite 1**

Com o perfil `backend` no ar e o `queue` rodando:

```sh
docker compose --profile backend exec -T app php artisan tinker --execute="
\$p = App\Models\Publication::create(['slug'=>'prova-da-fase-9','category'=>'artigo','published_at'=>now(),'featured'=>false,'status'=>App\Models\Publication::STATUS_PUBLISHED]);
\$p->translations()->create(['locale'=>'pt','title'=>'Prova da fase 9','summary'=>'Resumo.','body'=>'Primeiro.\n\nSegundo.']);
\$p->translations()->create(['locale'=>'en','title'=>'Phase 9 proof','summary'=>'Summary.','body'=>'First.\n\nSecond.']);
"
```

Espere o job (5s de atraso mais o prerender) e então:

```sh
curl -s -o /dev/null -w "artigo: %{http_code}\n" http://localhost:8080/pt/publicacoes/prova-da-fase-9
curl -s http://localhost:8080/sitemap.xml | grep -c prova-da-fase-9
curl -s http://localhost:8080/pt | grep -c prova-da-fase-9
```

Esperado: `200`, `1` ou mais, `1` ou mais. **É este o critério de aceite 1.**

Limpe depois:

```sh
docker compose --profile backend exec -T app php artisan tinker --execute="App\Models\Publication::where('slug','prova-da-fase-9')->first()->delete();"
```

- [ ] **Passo 9: commitar**

```sh
git add backend/app/Jobs backend/app/Observers backend/config/publishing.php backend/app/Providers/AppServiceProvider.php backend/tests/Feature/RegenerateSiteTest.php
git commit -m "feat(publicacao): job de regeracao disparado ao salvar"
```

---

### Tarefa 7: o fallback `@app`, caminho de exceção com `noindex`

Cobre só a janela entre salvar e o job terminar. Ser alcançado significa que o
pipeline falhou, e isso precisa aparecer no log. Sem canonical, sem hreflang, sem
Open Graph e sem JSON-LD: afirmar qualquer um deles a partir de uma segunda
implementação é como o canonical errado nasce.

**Arquivos:**
- Criar: `backend/app/Http/Controllers/FallbackController.php`
- Criar: `backend/resources/views/fallback.blade.php`
- Criar: `backend/tests/Feature/FallbackTest.php`
- Modificar: `backend/routes/web.php`, `docker/web/default.conf:47-57`

- [ ] **Passo 1: escrever o teste que falha**

Criar `backend/tests/Feature/FallbackTest.php`:

```php
<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Publication;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FallbackTest extends TestCase
{
    use RefreshDatabase;

    public function test_publicacao_que_existe_no_banco_responde_200_com_noindex(): void
    {
        $publication = Publication::create([
            'slug' => 'ainda-nao-no-disco',
            'category' => 'artigo',
            'published_at' => now(),
            'featured' => false,
            'status' => Publication::STATUS_PUBLISHED,
        ]);
        $publication->translations()->create([
            'locale' => 'pt',
            'title' => 'Ainda nao no disco',
            'summary' => 'Resumo.',
            'body' => "Primeiro paragrafo.\n\nSegundo paragrafo.",
        ]);

        $response = $this->get('/pt/publicacoes/ainda-nao-no-disco');

        $response->assertOk();
        $response->assertSee('Ainda nao no disco');
        $response->assertSee('Primeiro paragrafo.');
        $response->assertSee('noindex', false);
        // O caminho de excecao nao afirma canonical: uma segunda implementacao
        // de SEO e como o canonical errado nasce.
        $response->assertDontSee('rel="canonical"', false);
    }

    public function test_slug_que_nao_existe_responde_404(): void
    {
        $this->get('/pt/publicacoes/nao-existe')->assertNotFound();
    }

    public function test_rascunho_nao_vaza_pelo_fallback(): void
    {
        $publication = Publication::create([
            'slug' => 'rascunho',
            'category' => 'artigo',
            'published_at' => now(),
            'featured' => false,
            'status' => Publication::STATUS_DRAFT,
        ]);
        $publication->translations()->create([
            'locale' => 'pt',
            'title' => 'Rascunho',
            'summary' => 'Resumo.',
            'body' => 'Texto.',
        ]);

        $this->get('/pt/publicacoes/rascunho')->assertNotFound();
    }
}
```

- [ ] **Passo 2: rodar e ver falhar**

```sh
docker compose --profile backend exec -T app php artisan test --filter=FallbackTest
```

Esperado: FALHA — as três, com 404 onde se esperava 200 e rota inexistente.

- [ ] **Passo 3: escrever o controller**

Criar `backend/app/Http/Controllers/FallbackController.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Publication;
use Illuminate\Contracts\View\View;
use Illuminate\Support\Facades\Log;

/**
 * A casca de excecao, servida quando o arquivo ainda nao esta no disco.
 *
 * Alcancar este controller significa que o pipeline de publicacao falhou ou
 * ainda nao terminou. O `Log::warning` existe para que isso apareca em algum
 * lugar em vez de virar um 200 silencioso e permanente.
 */
class FallbackController extends Controller
{
    public function show(string $locale, string $segment, string $slug): View
    {
        // Laravel entrega os parametros na ordem do padrao da rota, entao o
        // `$segment` precisa estar na assinatura: sem ele, `$slug` receberia
        // "publicacoes" e toda busca falharia.
        //
        // O par idioma/segmento e validado aqui e nao no `where` da rota: o
        // cruzamento /pt/publications/... casa no padrao e precisa dar 404, que
        // e o que a fase 6 comprou ao tirar o fallback para index.html.
        abort_unless($segment === ($locale === 'pt' ? 'publicacoes' : 'publications'), 404);

        Log::warning('fallback @app alcancado', ['locale' => $locale, 'slug' => $slug]);

        $publication = Publication::query()
            ->where('slug', $slug)
            ->where('status', Publication::STATUS_PUBLISHED)
            ->firstOrFail();

        $translation = $publication->translations()
            ->where('locale', $locale)
            ->firstOrFail();

        return view('fallback', [
            'locale' => $locale,
            'title' => $translation->title,
            // Mesma divisao que a API faz: linha em branco separa paragrafo.
            'paragraphs' => preg_split('/\n\s*\n/', trim((string) $translation->body)) ?: [],
        ]);
    }
}
```

- [ ] **Passo 4: escrever a Blade**

Criar `backend/resources/views/fallback.blade.php`:

```blade
<!doctype html>
<html lang="{{ $locale }}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
{{-- O caminho de excecao nunca e indexado: quem indexa e o arquivo do disco. --}}
<meta name="robots" content="noindex">
<title>{{ $title }}</title>
</head>
<body>
<main>
<h1>{{ $title }}</h1>
@foreach ($paragraphs as $paragraph)
<p>{{ $paragraph }}</p>
@endforeach
</main>
<p><a href="/{{ $locale }}">{{ $locale === 'pt' ? 'Voltar ao inicio' : 'Back to home' }}</a></p>
</body>
</html>
```

- [ ] **Passo 5: registrar a rota**

Em `backend/routes/web.php`:

```php
use App\Http\Controllers\FallbackController;

Route::get('/{locale}/{segment}/{slug}', [FallbackController::class, 'show'])
    ->where('locale', 'pt|en')
    // Os segmentos traduzidos sao os mesmos de `src/core/routing.ts`. Mudar um
    // sem o outro e como o endereco do outro idioma virava 200 antes da fase 6.
    ->where('segment', 'publicacoes|publications')
    ->where('slug', '[a-z0-9]+(?:-[a-z0-9]+)*');
```

O `where` acima aceita `/pt/publications/...`, que é o cruzamento que a fase 6 fez
responder 404. A guarda está no `abort_unless` do controller, já escrito no Passo 3.
Acrescente o caso ao teste:

```php
public function test_o_segmento_do_outro_idioma_responde_404(): void
{
    $publication = Publication::create([
        'slug' => 'cruzado',
        'category' => 'artigo',
        'published_at' => now(),
        'featured' => false,
        'status' => Publication::STATUS_PUBLISHED,
    ]);
    $publication->translations()->create([
        'locale' => 'pt',
        'title' => 'Cruzado',
        'summary' => 'Resumo.',
        'body' => 'Texto.',
    ]);

    $this->get('/pt/publications/cruzado')->assertNotFound();
}
```

- [ ] **Passo 6: rodar e ver passar**

```sh
docker compose --profile backend exec -T app php artisan test --filter=FallbackTest
```

Esperado: PASSA, 4 testes.

- [ ] **Passo 7: reativar o `@app` no Nginx**

Em `docker/web/default.conf`, substituir as linhas 47-57:

```nginx
    location ~ ^/(pt/publicacoes|en/publications)(/|$) {
        add_header Cache-Control "no-cache";
        try_files $uri $uri/index.html @app;
    }

    location @app {
        set $upstream app:9000;
        fastcgi_pass $upstream;
        fastcgi_param SCRIPT_FILENAME /var/www/public/index.php;
        include fastcgi_params;
    }
```

O `set $upstream` é o mesmo motivo documentado na linha 16: sem a variável o Nginx
resolve o nome ao carregar a configuração e se recusa a subir com o perfil `backend`
desligado.

- [ ] **Passo 8: provar a janela**

```sh
docker compose build web && docker compose up -d web
docker compose --profile backend exec -T app php artisan tinker --execute="
\$p = App\Models\Publication::create(['slug'=>'janela-do-fallback','category'=>'artigo','published_at'=>now(),'featured'=>false,'status'=>App\Models\Publication::STATUS_PUBLISHED]);
\$p->translations()->create(['locale'=>'pt','title'=>'Janela do fallback','summary'=>'R.','body'=>'Texto.']);
"
curl -s http://localhost:8080/pt/publicacoes/janela-do-fallback | grep -o "noindex"
```

Esperado: `noindex` nos primeiros segundos, antes de o job terminar. Depois do job, a
mesma URL passa a servir o arquivo do disco, que **não** tem `noindex`:

```sh
curl -s http://localhost:8080/pt/publicacoes/janela-do-fallback | grep -c noindex
```

Esperado: `0`. Limpe o registro depois.

- [ ] **Passo 9: commitar**

```sh
git add backend/app/Http/Controllers/FallbackController.php backend/resources/views/fallback.blade.php backend/routes/web.php backend/tests/Feature/FallbackTest.php docker/web/default.conf
git commit -m "feat(fallback): casca @app com noindex enquanto o job nao termina"
```

**Fim da fatia 1.** Aqui o critério de aceite 1 está entregue: publicar pelo Filament
faz a URL responder 200 com o texto, sem rebuild de imagem.

---

# Fatia 2 · Contrato de API e escala

### Tarefa 8: `limit` ganha teto e a resposta ganha `meta`

Hoje `PublicationController.php:20` corta em 100 e a validação aceita no máximo 200,
sem dizer a ninguém que cortou. Um site publicado com metade do acervo é pior que um
build vermelho, e para o prerender poder falhar ele precisa saber.

**Arquivos:**
- Modificar: `backend/app/Http/Controllers/Api/PublicationController.php:20,33`
- Teste: `backend/tests/Feature/PublicationApiTest.php`

**Interfaces:**
- Produz: a resposta de `index` passa a trazer
  `meta: { count: int, limit: int, truncated: bool }`.
  `truncated` é `count === limit` com mais linhas disponíveis no banco.

- [ ] **Passo 1: escrever o teste que falha**

Acrescentar a `backend/tests/Feature/PublicationApiTest.php`:

```php
public function test_a_resposta_declara_count_limit_e_truncated(): void
{
    Publication::factory()->count(3)->hasTranslations(1, ['locale' => 'pt'])->create([
        'status' => Publication::STATUS_PUBLISHED,
    ]);

    $response = $this->getJson('/api/publications?locale=pt');

    $response->assertOk();
    $response->assertJsonPath('meta.count', 3);
    $response->assertJsonPath('meta.truncated', false);
}

public function test_truncated_fica_verdadeiro_quando_o_limite_corta(): void
{
    Publication::factory()->count(3)->hasTranslations(1, ['locale' => 'pt'])->create([
        'status' => Publication::STATUS_PUBLISHED,
    ]);

    $response = $this->getJson('/api/publications?locale=pt&limit=2');

    $response->assertJsonPath('meta.count', 2);
    $response->assertJsonPath('meta.limit', 2);
    $response->assertJsonPath('meta.truncated', true);
}

public function test_o_teto_do_limite_e_mil(): void
{
    $this->getJson('/api/publications?locale=pt&limit=1001')->assertStatus(422);
    $this->getJson('/api/publications?locale=pt&limit=1000')->assertOk();
}
```

Se não houver factories para `Publication` e `PublicationTranslation`, crie-as antes,
em `backend/database/factories/`, com `slug` via `fake()->slug()`, `category` sorteada
de `Publication::CATEGORIES`, `published_at` no passado e `status` publicado.

- [ ] **Passo 2: rodar e ver falhar**

```sh
docker compose --profile backend exec -T app php artisan test --filter=PublicationApiTest
```

Esperado: FALHA — não existe `meta` na resposta, e `limit=1001` passa na validação.

- [ ] **Passo 3: implementar**

Em `PublicationController::index`, trocar a regra de `limit` e o retorno:

```php
'limit' => ['sometimes', 'integer', 'min:1', 'max:1000'],
```

```php
$limit = $input['limit'] ?? self::DEFAULT_LIMIT;

$publications = $this->published($locale)
    // ...as mesmas clausulas when()...
    ->orderByDesc('publications.published_at')
    // Pede uma a mais do que cabe: e assim que se sabe que havia mais sem
    // pagar um segundo count() sobre o join.
    ->limit($limit + 1)
    ->get();

$truncated = $publications->count() > $limit;
$publications = $publications->take($limit);

return PublicationResource::collection($publications)->additional([
    'meta' => [
        'count' => $publications->count(),
        'limit' => $limit,
        'truncated' => $truncated,
    ],
]);
```

- [ ] **Passo 4: rodar e ver passar**

```sh
docker compose --profile backend exec -T app php artisan test --filter=PublicationApiTest
```

- [ ] **Passo 5: commitar**

```sh
git add backend/app/Http/Controllers/Api/PublicationController.php backend/tests backend/database/factories
git commit -m "feat(api): teto de 1000 e meta com count, limit e truncated"
```

---

### Tarefa 9: acervo truncado derruba o prerender

**Arquivos:**
- Modificar: `src/data/PublicationsSource.ts` (adapter HTTP, `list`)
- Teste: `src/data/PublicationsSource.test.ts`

**Interfaces:**
- Produz: `createHttpSource` passa a aceitar
  `options?: { onTruncated?: (meta: { count: number; limit: number }) => void }`.
  Sem a opção, truncamento lança. É o que faz o build falhar em Node e o que
  permite ao cliente apenas avisar.

- [ ] **Passo 1: escrever o teste que falha**

```ts
it('lanca quando a API diz que truncou, para o build nao publicar meio acervo', async () => {
  const fetchImpl = (async () =>
    new Response(JSON.stringify({ data: [], meta: { count: 2, limit: 2, truncated: true } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as unknown as typeof fetch;

  const source = createHttpSource('http://api', fetchImpl);

  await expect(source.list({ locale: 'pt' })).rejects.toThrow(/truncad/i);
});

it('avisa em vez de lancar quando quem chama oferece onTruncated', async () => {
  const fetchImpl = (async () =>
    new Response(JSON.stringify({ data: [], meta: { count: 2, limit: 2, truncated: true } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as unknown as typeof fetch;

  const avisos: { count: number; limit: number }[] = [];
  const source = createHttpSource('http://api', fetchImpl, {
    onTruncated: (meta) => avisos.push(meta),
  });

  await expect(source.list({ locale: 'pt' })).resolves.toEqual([]);
  expect(avisos).toEqual([{ count: 2, limit: 2 }]);
});
```

- [ ] **Passo 2: rodar e ver falhar**

```sh
docker compose run --rm node npx vitest run src/data/PublicationsSource.test.ts
```

Esperado: FALHA — a promessa resolve em vez de rejeitar.

- [ ] **Passo 3: implementar**

Em `src/data/PublicationsSource.ts`, no adapter HTTP:

```ts
interface ApiMeta {
  readonly count: number;
  readonly limit: number;
  readonly truncated: boolean;
}

export interface HttpSourceOptions {
  /**
   * Chamado quando a API declara que cortou o acervo.
   *
   * Sem isto, truncamento lanca — que e o comportamento que o prerender quer:
   * um site publicado com metade do acervo e pior que um build vermelho. No
   * cliente, truncamento e falha de operacao, nao estado de leitura, entao la
   * quem chama passa um aviso de console e a constelacao segue.
   */
  readonly onTruncated?: (meta: { count: number; limit: number }) => void;
}

export function createHttpSource(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
  options: HttpSourceOptions = {},
): PublicationsSource {
```

e, dentro de `list`, depois de obter o payload:

```ts
const payload = await json<{ data: readonly ApiPublication[]; meta?: ApiMeta }>(
  `${root}?${params.toString()}`,
);

if (payload.meta?.truncated === true) {
  const meta = { count: payload.meta.count, limit: payload.meta.limit };
  if (options.onTruncated === undefined) {
    throw new Error(
      `A API truncou o acervo em ${String(meta.limit)} de ${String(meta.count)} ou mais. ` +
        'Publicar o site assim esconderia publicacoes.',
    );
  }
  options.onTruncated(meta);
}

return payload.data.map(fromApi);
```

- [ ] **Passo 4: rodar e ver passar**

```sh
docker compose run --rm node npx vitest run src/data/PublicationsSource.test.ts
```

- [ ] **Passo 5: commitar**

```sh
git add src/data/PublicationsSource.ts src/data/PublicationsSource.test.ts
git commit -m "feat(api): truncamento derruba o prerender e avisa no cliente"
```

---

### Tarefa 10: no cliente, truncamento é aviso de console

**Arquivos:**
- Modificar: `src/data/source.ts`

- [ ] **Passo 1: implementar**

```ts
export function createSource(): PublicationsSource {
  if (__API_URL__ === null) return createStaticSource(PUBLICATIONS);

  return createHttpSource(__API_URL__, fetch, {
    // Falha de operacao, nao estado de leitura: a pessoa que le nao tem o que
    // fazer com isso, e apagar a constelacao seria pior que mostra-la menor.
    onTruncated: ({ count, limit }) => {
      console.warn(
        `A API truncou o acervo em ${String(limit)} de ${String(count)} ou mais publicacoes.`,
      );
    },
  });
}
```

- [ ] **Passo 2: conferir que o prerender continua lançando**

`src/prerender/main.ts` monta o adapter HTTP sem `onTruncated` (Tarefa 2, Passo 6),
então ele continua no comportamento estrito. Confirme lendo o arquivo.

- [ ] **Passo 3: rodar o gate e commitar**

```sh
docker compose run --rm node npm run check
git add src/data/source.ts && git commit -m "feat(cliente): truncamento vira aviso de console"
```

---

### Tarefa 11: `summaries.find` vira `Map`

`App.tsx:136` faz uma busca linear por estrela a cada render — 250 mil comparações
por passada com 500 publicações. O mesmo padrão aparece em `onHover` e `hoverCard`.

**Arquivos:**
- Modificar: `src/App.tsx:136` e os outros dois pontos com o mesmo padrão

- [ ] **Passo 1: construir o índice uma vez**

Perto de onde `summaries` é definido:

```tsx
/** Índice por slug: o mesmo objeto serve labelFor, onHover e hoverCard. */
const bySlug = useMemo(
  () => new Map(summaries.map((summary) => [summary.slug, summary])),
  [summaries],
);
```

- [ ] **Passo 2: trocar as três buscas**

```tsx
const labelFor = useCallback(
  (star: PlacedStar) => {
    const title = bySlug.get(star.slug)?.title ?? star.slug;
    return `${title} — ${t.categories[star.category]} — ${dateLabel(star.timestamp)}`;
  },
  [bySlug, t, dateLabel],
);
```

Aplique o mesmo em `onHover` e `hoverCard`, trocando `summaries.find((item) => item.slug === ...)`
por `bySlug.get(...)` e ajustando as listas de dependências de `summaries` para `bySlug`.

- [ ] **Passo 3: medir com acervo sintético**

```sh
docker compose run --rm node npx vitest run src/data/synthetic.test.ts
docker compose run --rm node npm run check
```

- [ ] **Passo 4: commitar**

```sh
git add src/App.tsx && git commit -m "perf(constelacao): indice por slug no lugar de busca linear"
```

---

# Fatia 3 · Fronteiras de código

Esta fatia **não muda comportamento**. O gate é a suíte inteira continuar verde sem
que nenhum teste precise ser reescrito — se um precisar, o corte está errado.

### Tarefa 12: `core/timeline.ts` vira três módulos

505 linhas, três assuntos. A suíte já assumiu a divisão sozinha ao se separar em
`timeline.test.ts` e `timeline.geometry.test.ts`.

**Arquivos:**
- Criar: `src/core/hash.ts` (FNV-1a), `src/core/geometry.ts` (faixa, conectores, anos,
  limites de pan, janela visível)
- Modificar: `src/core/timeline.ts` (só colocação temporal), e os imports de quem consome

- [ ] **Passo 1: mover sem mudar**

Mova as funções, mantendo nomes e assinaturas idênticos. Reexporte de `timeline.ts` o
que outros módulos importam de lá, para o passo ser puramente mecânico.

- [ ] **Passo 2: rodar a suíte**

```sh
docker compose run --rm node npm run check
```

Esperado: 328 testes verdes, nenhum arquivo de teste alterado.

- [ ] **Passo 3: trocar os imports dos consumidores e remover as reexportações**

```sh
docker compose run --rm node npm run check
```

- [ ] **Passo 4: commitar**

```sh
git add src/core && git commit -m "refactor(core): separa hash e geometria de timeline"
```

---

### Tarefa 13: `useCosmosEngine.ts` vira `core/camera.ts` + `hooks/useCosmosInput.ts`

571 linhas, três papéis. É onde moram os defeitos de câmera desfazendo o recuo que o
fechamento promete — e hoje nada disso é testável. O defeito do limiar de arraste
corrigido antes desta fase é o precedente.

**Arquivos:**
- Criar: `src/core/camera.ts`, `src/core/camera.test.ts`, `src/hooks/useCosmosInput.ts`
- Modificar: `src/hooks/useCosmosEngine.ts`

**Interfaces:**
- Produz: `CameraState { pan: number; panS: number; enter: number; enterS: number; zoom: number; velocity: number }`
  e as funções puras `goHome(state)`, `slideTo(state, target, bounds)`,
  `jumpTo(state, target, bounds)`, `openStar(state, star, bounds)`,
  `closeReader(state, originPan, bounds)` — todas recebem e devolvem `CameraState`,
  sem DOM.

- [ ] **Passo 1: escrever o teste que falha**

```ts
it('fechar o leitor devolve exatamente o pan de onde a estrela foi aberta', () => {
  const bounds = { min: -1000, max: 1000 };
  const aberto = openStar(base({ pan: 120 }), { pan: 480 } as PlacedStar, bounds);
  const fechado = closeReader(aberto, 120, bounds);

  expect(fechado.pan).toBe(120);
});

it('nao devolve um pan fora dos limites quando o acervo encolheu', () => {
  const bounds = { min: -100, max: 100 };
  expect(closeReader(base({ pan: 0 }), 5000, bounds).pan).toBe(100);
});
```

Escreva um helper `base(overrides)` que devolve um `CameraState` completo.

- [ ] **Passo 2: rodar, ver falhar, implementar, ver passar**

```sh
docker compose run --rm node npx vitest run src/core/camera.test.ts
```

- [ ] **Passo 3: extrair os ouvintes para `useCosmosInput.ts`**

Leve o `useEffect` dos ouvintes de `wheel`, `keydown`, `pointermove`, `pointerup`,
`pointercancel`, `touchstart` e `touchmove`, mais `onCosmosPointerDown` e
`onRailPointerDown`. O motor fica com o `requestAnimationFrame` ligando os dois.

- [ ] **Passo 4: gate e commit**

```sh
docker compose run --rm node npm run check
git add src/core/camera.ts src/core/camera.test.ts src/hooks
git commit -m "refactor(motor): camera pura e entrada separadas do laco"
```

---

### Tarefa 14: `absolute()` deixa de ser duplicado

Existe igual em `core/seo.ts:66` e `core/sitemap.ts:23`.

- [ ] **Passo 1:** criar `src/core/url.ts` exportando `absolute(origin, path)`, com o
  comentário que hoje está em `seo.ts` (o motivo é o canonical, não a estética).
- [ ] **Passo 2:** importar nos dois e apagar as cópias.
- [ ] **Passo 3:** `docker compose run --rm node npm run check` e commitar.

---

### Tarefa 15: o vocabulário passa a ter fonte única

Hoje a lista de idiomas existe em `core/types.ts`, em `PublicationTranslation::LOCALES`,
em `PublicationController::DICTIONARY` e no `CASE` de uma migration já aplicada.

**Arquivos:**
- Modificar: `scripts/emit-seed.ts`
- Gerado: `backend/config/publications.php`
- Modificar: `PublicationTranslation`, `PublicationController` para lerem do config

- [ ] **Passo 1:** fazer `emit:seed` emitir também `backend/config/publications.php`
  com `locales`, `categories` e `dictionaries`, no mesmo precedente do
  `publications.json` — cabeçalho dizendo que é gerado e não deve ser editado.
- [ ] **Passo 2:** trocar `PublicationTranslation::LOCALES` e
  `PublicationController::DICTIONARY` por leituras de `config('publications.*')`,
  mantendo as constantes como reexportação se algum teste depender delas.
- [ ] **Passo 3:** rodar `npm run emit:seed`, a suíte PHP e a de TypeScript.
- [ ] **Passo 4:** commitar.

A migration já aplicada fica como está: reescrever histórico de migration é pior que
a duplicação que ela guarda. Registre no `CLAUDE.md` que o `CASE` dela é uma cópia
congelada.

---

# Fatia 4 · Resiliência no cliente

### Tarefa 16: a casca sobrevive a um erro de runtime

`main.tsx:25` remove a casca antes de o React montar. Se o React quebrar, o leitor
fica com tela preta e o conteúdo que já estava no HTML foi destruído.

**Arquivos:**
- Criar: `src/components/ErrorBoundary/ErrorBoundary.tsx`
- Modificar: `src/main.tsx:25`, `src/App.tsx`

- [ ] **Passo 1: escrever o ErrorBoundary**

```tsx
import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  readonly children: ReactNode;
}

interface State {
  readonly failed: boolean;
}

/**
 * Quando o React quebra, quem estava lendo continua lendo.
 *
 * A casca pre-renderizada ja tem o artigo inteiro no HTML. Este limite esconde
 * o `#root` e deixa a casca no lugar, em vez de trocar texto por tela preta.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('A constelacao falhou; a casca pre-renderizada fica no lugar.', error, info);
    document.getElementById('root')?.setAttribute('hidden', '');
    document.getElementById('prerender')?.removeAttribute('hidden');
  }

  override render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}
```

- [ ] **Passo 2: inverter a ordem em `main.tsx`**

Remover a linha 25 e, no lugar, montar primeiro:

```tsx
createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
```

A remoção da casca passa para um efeito dentro de `App`, depois do primeiro commit
bem-sucedido:

```tsx
useEffect(() => {
  // Depois do primeiro commit, nao antes: se o React quebrar na montagem, a
  // casca precisa continuar la.
  document.getElementById('prerender')?.setAttribute('hidden', '');
}, []);
```

`hidden` e não `remove()`: o ErrorBoundary precisa poder trazê-la de volta.

- [ ] **Passo 3: testar em jsdom**

Um teste com Testing Library que renderiza um filho que lança e afirma que
`#prerender` não está escondido e `#root` está. Isto exige `environment: 'jsdom'` no
`vitest.config.ts` para os arquivos de componente — configure por `environmentMatchGlobs`
para não tornar a suíte de `core/` mais lenta.

- [ ] **Passo 4: gate e commit**

---

# Fatia 5 · Open Graph

### Tarefa 17: imagem de `og:image` gerada no prerender

Hoje `core/seo.ts` não emite `og:image` nenhuma: todo link compartilhado sai sem cartão.

- [ ] **Passo 1:** criar `src/prerender/og.ts` que gera um PNG a partir dos tokens
  reais lidos de `src/styles/tokens.css`, com nome derivado de um hash de título e
  idioma — o que não mudou não é redesenhado.
- [ ] **Passo 2:** acrescentar `og:image` (URL absoluta, via `core/url.ts`) ao
  cabeçalho em `core/seo.ts`, com teste em `seo.test.ts`.
- [ ] **Passo 3:** chamar a geração em `src/prerender/main.ts`, gravando em
  `${DIST}/og/`.
- [ ] **Passo 4:** conferir que o `sitemap.xml` não lista as imagens e que o build
  não regenera as que já existem.

---

# Fatia 6 · CI, retaguardas e documentação

### Tarefa 18: `ci.yml` com quatro jobs

- [ ] **frontend:** `npm run check`, build e prerender contra fixtures.
- [ ] **backend:** Postgres de serviço, `pint --test`, PHPStan nível 8 (Larastan, sem
  baseline), `artisan test` com banco terminado em `_test`.
- [ ] **e2e:** Playwright contra o build servido — navegação, histórico, 404 com
  status real, página sem JavaScript.
- [ ] **integração:** `docker compose --profile backend`, publica pelo Filament e
  verifica que a URL do artigo responde 200 com o texto. **É este job que prova a
  fase inteira.**

Mais `review.yml`, com o revisor comentando na PR.

### Tarefa 19: hooks rápidos e finais de linha

- [ ] **Passo 1: criar o `.gitattributes`**

Sem ele, `core.autocrlf=true` grava CRLF na árvore no próximo checkout e todo script
de shell quebra dentro do container Linux com `bad interpreter: no such file`. O
repositório não tem nenhum hoje.

```gitattributes
# Fim de linha: o repositorio normaliza para LF, e estes arquivos precisam sair
# com LF na arvore tambem. Com core.autocrlf=true no Windows, sem isto um
# checkout grava CRLF e todo script quebra dentro do container Linux.
* text=auto eol=lf

.githooks/*      text eol=lf
docker/**/*.sh   text eol=lf
backend/artisan  text eol=lf

*.png binary
*.jpg binary
*.woff binary
*.woff2 binary
```

Depois de criar, renormalize e confira que nada mudou de conteúdo:

```sh
git add --renormalize .
git status --short
```

- [ ] **Passo 2: `pre-commit` só sobre o que mudou**

Hoje `.githooks/pre-commit` roda `npm run check` inteiro, e é por isso que
`--no-verify` é tentador.

```sh
#!/bin/sh
# Gate rapido: so o que mudou. A suite completa fica no pre-push.
set -e

STAGED="$(git diff --cached --name-only --diff-filter=ACM)"

FRONT="$(echo "$STAGED" | grep -E '^src/|^scripts/|\.ts$|\.tsx$' || true)"
if [ -n "$FRONT" ]; then
  docker compose run --rm -T node npx eslint $FRONT
  docker compose run --rm -T node npm run typecheck
fi

BACK="$(echo "$STAGED" | grep -E '^backend/.*\.php$' || true)"
if [ -n "$BACK" ]; then
  docker compose --profile backend run --rm -T app ./vendor/bin/pint --test $BACK
fi
```

- [ ] **Passo 3: `pre-push` com a suíte completa**

Criar `.githooks/pre-push`:

```sh
#!/bin/sh
# O gate de verdade. Pular pontualmente com: git push --no-verify
set -e
docker compose run --rm -T node npm run check
```

- [ ] **Passo 4: conferir que os hooks estão ligados e executáveis**

```sh
git config core.hooksPath .githooks
git update-index --chmod=+x .githooks/pre-commit .githooks/pre-push
```

- [ ] **Passo 5: commitar**

### Tarefa 20: validação de ambiente

- [ ] `scripts/check-env.ts`, chamado no `predev`, no `prebuild` e no CI: chaves
  faltando ou sobrando em relação ao `.env.example` e, em produção, `APP_DEBUG=false`,
  `APP_KEY` presente, senha de banco não vazia e `VITE_SITE_URL` absoluta.

### Tarefa 21: documentação

- [ ] `README.md`: afirma que o backend não existe e que será Laravel 11; as duas
  coisas deixaram de ser verdade na fase 8. Reescrever onde mente e acrescentar o
  pipeline de publicação, o CI e os hooks.
- [ ] `CLAUDE.md`: registrar as decisões desta spec, o achado do `VITE_API_URL` na
  imagem `web`, a nota da migration congelada da Tarefa 15, e as fases 10 e 11.
- [ ] Proteção de branch fica **documentada**, com os valores exatos, e não aplicada:
  mexer nas configurações do repositório é decisão de quem o administra.

---

## Riscos herdados da spec

- **Tempo do prerender completo.** Mil páginas por publicação é a aposta que sustenta
  "um caminho de código só". A Tarefa 6 registra a medição em log justamente para que
  a decisão de cortar por slug seja tomada com número.
- **Imagem PHP mais pesada.** Node no container do backend é o preço de não ter um
  quarto serviço.
- **Volume compartilhado entre `web` e `queue`.** Dois escritores no mesmo diretório;
  a gravação precisa ser atômica. `src/prerender/main.ts` grava com `writeFile`
  direto — **na Tarefa 6, trocar por arquivo temporário e `rename`**, senão o Nginx
  pode servir HTML pela metade.

---

# Fatia 7 · Cobertura que a spec exige

Executar **antes da fatia 6**: o job `frontend` do CI roda esta suíte, então ela
precisa existir primeiro.

### Tarefa 22: a `Shell` em jsdom

A spec lista cinco comportamentos que hoje nada cobre, e todos moram exatamente onde a
Tarefa 13 mexeu: histórico, foco e a câmera que desfaz o recuo que o fechamento
promete.

**Arquivos:**
- Criar: `src/components/Shell/Shell.test.tsx`
- Modificar: `vitest.config.ts`

- [ ] **Passo 1: confirmar o jsdom que a Tarefa 16 já configurou**

A Tarefa 16 é a dona de `environmentMatchGlobs` no `vitest.config.ts` — ela precisa de
jsdom para o próprio teste do ErrorBoundary e executa antes desta. Confirme que a
entrada existe e cobre `src/components/**`; estenda o glob se este teste morar fora
dele, mas **não reescreva a linha**.

```ts
    // jsdom so onde precisa: a suite de core/ e pura e fica mais lenta com ele.
    environmentMatchGlobs: [['src/components/**', 'jsdom']],
```

Se `@testing-library/user-event` ainda não estiver instalado (a Tarefa 16 só precisa
de `@testing-library/react`):

```sh
docker compose run --rm node npm i -D @testing-library/user-event
```

- [ ] **Passo 2: escrever os cinco testes**

```tsx
it('abrir uma estrela empilha uma entrada de historico', async () => {
  const user = userEvent.setup();
  render(<Shell />);
  await entrarNaConstelacao(user);

  const antes = window.history.length;
  await user.click(await screen.findByRole('link', { name: /Arquitetura/ }));

  expect(window.location.pathname).toBe('/pt/publicacoes/arquitetura-e-orquestracao-de-llms');
  expect(window.history.length).toBe(antes + 1);
});

it('voltar fecha a vista de leitura sem exigir dois toques', async () => {
  const user = userEvent.setup();
  render(<Shell />);
  await entrarNaConstelacao(user);
  await user.click(await screen.findByRole('link', { name: /Arquitetura/ }));

  window.history.back();

  await waitFor(() => {
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });
});

it('Esc durante a abertura fecha sem deixar a camera no meio do caminho', async () => {
  const user = userEvent.setup();
  render(<Shell />);
  await entrarNaConstelacao(user);
  await user.click(await screen.findByRole('link', { name: /Arquitetura/ }));
  await user.keyboard('{Escape}');

  await waitFor(() => {
    expect(window.location.pathname).toBe('/pt');
  });
});

it('fechar devolve o foco a estrela de onde se saiu', async () => {
  const user = userEvent.setup();
  render(<Shell />);
  await entrarNaConstelacao(user);
  const estrela = await screen.findByRole('link', { name: /Arquitetura/ });
  await user.click(estrela);
  await user.keyboard('{Escape}');

  await waitFor(() => {
    expect(document.activeElement).toBe(estrela);
  });
});

it('carga direta num slug que nao existe mostra o 404 dentro da constelacao', async () => {
  window.history.replaceState(null, '', '/pt/publicacoes/nao-existe');
  render(<Shell />);

  expect(await screen.findByText(/nao encontrad/i)).toBeInTheDocument();
});
```

`entrarNaConstelacao` é um helper que clica no botão de entrada e espera a fase virar
`cosmos`. Escreva-o no topo do arquivo — os cinco testes o usam.

- [ ] **Passo 3: rodar, ver falhar onde o comportamento não existe, corrigir, ver passar**

```sh
docker compose run --rm node npx vitest run src/components/Shell/Shell.test.tsx
```

Um teste que passa de primeira aqui é suspeito: confirme que ele falha mexendo no
código que ele deveria trancar.

- [ ] **Passo 4: commitar**

---

### Tarefa 23: orçamento de escala

**Arquivos:**
- Criar: `src/core/scale.test.ts`

- [ ] **Passo 1: escrever o teste**

```ts
import { describe, expect, it } from 'vitest';

import { connectors, placeStars, visibleRange } from './geometry';
import { syntheticPublications } from '../data/synthetic';

/**
 * Orcamento folgado de proposito.
 *
 * Nao e benchmark: e trava contra regressao de ordem de grandeza, do tipo que a
 * busca linear em App.tsx era. Numero apertado aqui vira teste intermitente em
 * CI compartilhado.
 */
function millis(work: () => void): number {
  const start = performance.now();
  work();
  return performance.now() - start;
}

describe.each([500, 1000])('acervo de %i publicacoes', (total) => {
  const publications = syntheticPublications(total);

  it('coloca as estrelas dentro do orcamento', () => {
    expect(millis(() => placeStars(publications))).toBeLessThan(150);
  });

  it('calcula conectores dentro do orcamento', () => {
    const stars = placeStars(publications);
    expect(millis(() => connectors(stars))).toBeLessThan(150);
  });

  it('calcula a janela visivel dentro do orcamento', () => {
    const stars = placeStars(publications);
    expect(millis(() => visibleRange(stars, 0, 1920))).toBeLessThan(50);
  });

  it('nao perde nenhuma publicacao pelo caminho', () => {
    expect(placeStars(publications)).toHaveLength(total);
  });
});
```

Ajuste os nomes e assinaturas a `src/data/synthetic.ts` e a `core/geometry.ts` como a
Tarefa 12 os deixou.

- [ ] **Passo 2: rodar e commitar**

```sh
docker compose run --rm node npx vitest run src/core/scale.test.ts
```

---

## Cobertura da spec

Conferência do plano contra cada seção da spec, feita depois de escrito.

| Seção da spec | Tarefas |
|---|---|
| 1 · Pipeline de publicação | 1, 2, 4, 5, 6 |
| 1 · Open Graph de carona | 17 |
| 2 · Fallback `@app` | 7 |
| 3 · Contrato e escala | 8, 9, 10, 11 |
| 4 · Fronteiras de código | 12, 13, 14, 15 |
| 5 · Resiliência no cliente | 16 |
| 6 · CI e retaguardas | 18, 19, 20 |
| 7 · Documentação | 21 |
| Testes (Shell, escala) | 22, 23 |
| — (achado fora da spec) | 3 |

Critérios de aceite: **1** fecha na Tarefa 6 Passo 8; **2** nas Tarefas 8–11 e 23;
**3** na 17; **4** na 18; **5** na 16.

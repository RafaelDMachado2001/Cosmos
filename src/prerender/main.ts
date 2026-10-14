/**
 * O passo que grava o HTML no disco, depois do build de cliente.
 *
 * Roda no Node, compilado por `vite.prerender.config.ts` para
 * `dist-ssr/prerender.js`, e é disparado pelo `postbuild` do npm — o
 * `docker/web/Dockerfile` conta com isso e não acrescenta um segundo RUN.
 *
 * Parte do HTML que o Vite emitiu no build de cliente — o `index.html` na
 * primeira passada, o sidecar `dist-ssr/template.html` depois disso (ver
 * `readTemplate`) — em vez de remontar as tags de script e de estilo a partir
 * do manifest: ali os nomes com hash já estão corretos, e recalculá-los seria
 * uma segunda fonte de verdade para a mesma coisa.
 */

import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { ogImagePath } from '../core/og';
import type { OgCard } from '../core/og';
import { stalePages } from '../core/prune';
import { articlePath, homePath } from '../core/routing';
import { DEFAULT_LOCALE, LOCALES } from '../core/types';
import { PUBLICATIONS } from '../data/publications';
import { createHttpSource, createStaticSource } from '../data/PublicationsSource';
import { missingAssets } from './assets';
import { apiUrlFrom, distDir, templateDir } from './config';
import { ogPng } from './og';
import { prerenderPages } from './pages';
import type { PrerenderedPage } from './pages';

const DIST = distDir(process.env);
const TEMPLATE_DIR = templateDir(process.env);
const SSR_DIR = 'dist-ssr';

/** Onde os cartões moram, igual ao prefixo de `ogImagePath`. */
const OG_DIR = 'og';

/** O ponto onde a casca entra. `src/main.tsx` a remove quando o React monta. */
const SLOT = '<div id="prerender"></div>';

const LANG = /<html lang="[^"]*">/;

/**
 * O que o template traz e o cabeçalho da rota substitui.
 *
 * Precisa sair antes, não depois: com dois `<title>` no documento vale o
 * primeiro, e o primeiro seria o genérico do `index.html` — cada artigo subiria
 * para o buscador com o título da tela de entrada. O mesmo vale para a
 * descrição.
 */
const TEMPLATE_TITLE = /[ \t]*<title>[\s\S]*?<\/title>\n?/;
const TEMPLATE_DESCRIPTION = /[ \t]*<meta\s+name="description"[\s\S]*?>\n?/;

/**
 * O CSS dos componentes estáticos, embutido em cada página.
 *
 * `ArticlePage` e `HomePage` não são importados pelo bundle de cliente — nada
 * ali os renderiza — então o CSS deles não existe no `dist`. Embutir é melhor
 * que publicar um segundo arquivo: são poucos KB, só fazem falta antes de o
 * React montar, e assim a página sem JavaScript não espera por outra requisição.
 */
async function readStaticCss(): Promise<string> {
  const entries = await readdir(SSR_DIR, { recursive: true, withFileTypes: true });
  const sheets = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.css'));

  if (sheets.length === 0) {
    throw new Error(
      `Nenhum CSS em ${SSR_DIR}/: as páginas estáticas sairiam sem estilo. ` +
        'Conferir build.ssrEmitAssets em vite.prerender.config.ts.',
    );
  }

  const parts = await Promise.all(
    sheets.map((sheet) => readFile(join(sheet.parentPath, sheet.name), 'utf8')),
  );
  return parts.join('\n');
}

function compose(template: string, page: PrerenderedPage, css: string): string {
  return template
    .replace(LANG, `<html lang="${page.lang}">`)
    .replace(TEMPLATE_TITLE, '')
    .replace(TEMPLATE_DESCRIPTION, '')
    .replace('</head>', `${page.head}\n<style data-head>${css}</style>\n</head>`)
    .replace(SLOT, `<div id="prerender">${page.body}</div>`);
}

/**
 * Grava por arquivo temporario e `rename`.
 *
 * O volume `site` tem dois escritores — o entrypoint do Nginx e o job — e
 * `rename` no mesmo sistema de arquivos e atomico: quem le ou pega o arquivo
 * antigo inteiro, ou o novo inteiro, nunca meio HTML com 200. O sufixo usa
 * `randomUUID`, não `process.pid`: os dois escritores rodam em containers
 * Docker separados, cada um com seu próprio namespace de PID, então os dois
 * podem ser PID 1 ao mesmo tempo — um nome baseado só no PID colidiria entre
 * eles.
 */
async function write(path: string, contents: string | Uint8Array): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, contents);
  await rename(temporary, path);
}

/**
 * O molde, preferindo a cópia intocada gravada ao lado do bundle.
 *
 * `<TEMPLATE_DIR>/index.html` só serve de molde na primeira passada de um
 * build novo — depois disso a raiz composta é gravada por cima dele (ver a
 * escrita da raiz em `main`). `template.html` é o sidecar que sobrevive a
 * qualquer número de publicações; ver Passo 5b.
 */
async function readTemplate(): Promise<{ html: string; path: string }> {
  const sidecar = join(TEMPLATE_DIR, 'template.html');
  try {
    return { html: await readFile(sidecar, 'utf8'), path: sidecar };
  } catch (error) {
    // Só a ausência do sidecar (primeira passada de um build novo, onde só
    // existe o index.html que o Vite acabou de emitir) justifica cair para o
    // fallback. Qualquer outro erro — permissão, leitura parcial — precisa
    // estourar aqui: escondê-lo atrás do index.html faria a validação do SLOT
    // culpar o arquivo errado.
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    const fallback = join(TEMPLATE_DIR, 'index.html');
    return { html: await readFile(fallback, 'utf8'), path: fallback };
  }
}

/**
 * Apaga do disco os artigos que esta passada nao gravou.
 *
 * O diretorio de artigo de cada idioma sai de `articlePath`: `routing.ts`
 * continua dono unico dos segmentos traduzidos. Some o diretorio do slug
 * inteiro, nao so o `index.html` — um diretorio vazio deixado para tras faria
 * o `try_files $uri/index.html` do Nginx cair no `@app` em vez de 404.
 */
async function pruneArticles(pages: readonly PrerenderedPage[]): Promise<readonly string[]> {
  const written = new Set(pages.map((page) => page.path.replace(/^\/+/, '')));

  const existing: string[] = [];
  for (const locale of LOCALES) {
    const articles = dirname(articlePath(locale, 'x')).replace(/^\/+/, '');
    let entries;
    try {
      entries = await readdir(join(DIST, articles), { withFileTypes: true });
    } catch (error) {
      // Primeira passada num destino vazio: nada a podar neste idioma.
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw error;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) existing.push(`${articles}/${entry.name}`);
    }
  }

  const stale = stalePages(existing, written);
  for (const path of stale) {
    await rm(join(DIST, path), { recursive: true, force: true });
  }
  return stale;
}

/**
 * Desenha só os cartões que ainda não existem.
 *
 * O nome é um hash de tudo o que o cartão mostra (ver `core/og.ts`): se o
 * arquivo está lá, é o mesmo desenho. É o que impede cada publicação de
 * redesenhar o acervo inteiro.
 */
async function drawOgImages(
  pages: readonly PrerenderedPage[],
): Promise<{ wanted: ReadonlySet<string>; drawn: number }> {
  const cards = new Map<string, OgCard>();
  for (const page of pages) if (page.og !== undefined) cards.set(ogImagePath(page.og), page.og);

  let drawn = 0;
  for (const [path, card] of cards) {
    const file = join(DIST, path);
    if (existsSync(file)) continue;
    await write(file, await ogPng(card));
    drawn += 1;
  }
  return { wanted: new Set(cards.keys()), drawn };
}

/**
 * Apaga os cartões que nenhuma página cita mais: um título editado deixa o
 * desenho antigo para trás. Só `.png` — um `.tmp` ali é escrita em andamento.
 */
async function pruneOgImages(wanted: ReadonlySet<string>): Promise<readonly string[]> {
  let entries;
  try {
    entries = await readdir(join(DIST, OG_DIR), { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const existing = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.png'))
    .map((entry) => `/${OG_DIR}/${entry.name}`);
  const stale = stalePages(existing, wanted);
  for (const path of stale) await rm(join(DIST, path), { force: true });
  return stale;
}

async function main(): Promise<void> {
  const { html: template, path: templatePath } = await readTemplate();

  // Um prerender que não encontra onde injetar grava páginas idênticas ao
  // index e não avisa ninguém: o site sobe, e só os buscadores percebem.
  if (!template.includes(SLOT)) {
    throw new Error(`${SLOT} não está em ${templatePath} — nada a preencher.`);
  }
  if (!template.includes('</head>')) {
    throw new Error(`${templatePath} sem </head> — não há onde pôr o cabeçalho.`);
  }

  // Antes de gravar qualquer coisa: um molde de outro build poria em cada
  // página scripts que o destino não tem, e o site inteiro ficaria sem
  // JavaScript respondendo 200.
  const missing = missingAssets(template, (path) => existsSync(join(DIST, path)));
  if (missing.length > 0) {
    throw new Error(
      `${templatePath} carrega assets que ${DIST}/ não tem: ${missing.join(', ')}. ` +
        'O molde e o destino vêm de builds diferentes.',
    );
  }

  /*
   * O molde, intocado, ao lado do bundle.
   *
   * A linha que grava a raiz compõe por cima de <DIST>/index.html, então o
   * próprio destino deixa de servir de molde depois da primeira passada. O job
   * da fase 9 roda este mesmo prerender a cada publicação: sem esta cópia ele
   * leria um SLOT já preenchido e morreria. Fica em dist-ssr porque o Nginx
   * não serve esse diretório.
   */
  await write(join(SSR_DIR, 'template.html'), template);

  const css = await readStaticCss();
  const apiUrl = apiUrlFrom(process.env);
  const source = apiUrl === null ? createStaticSource(PUBLICATIONS) : createHttpSource(apiUrl);
  const { pages, notFound, sitemap, robots } = await prerenderPages(source);

  // Os cartões antes das páginas: nenhum HTML gravado aponta para um
  // `og:image` que ainda não existe.
  const ogPaths = await drawOgImages(pages);

  for (const page of pages) {
    await write(join(DIST, page.path, 'index.html'), compose(template, page, css));
  }

  /**
   * A raiz recebe a casca do idioma padrão.
   *
   * Sem isto `/` serviria o template cru: título genérico e corpo vazio para
   * quem não executa JavaScript. O canonical dela aponta para `/pt`, que é onde
   * o conteúdo mora — é o que impede `/` e `/pt` de contarem como duas URLs do
   * mesmo texto.
   */
  const root = pages.find((page) => page.path === homePath(DEFAULT_LOCALE));
  if (root === undefined) {
    throw new Error(`prerender sem a raiz de ${DEFAULT_LOCALE}: ${DIST}/index.html ficaria cru.`);
  }
  await write(join(DIST, 'index.html'), compose(template, root, css));

  // O 404 é um arquivo solto, não uma rota: o Nginx o serve por `error_page`,
  // mantendo o endereço que a pessoa pediu e o status que o rastreador precisa.
  await write(join(DIST, notFound.path), compose(template, notFound, css));

  await write(join(DIST, 'sitemap.xml'), sitemap);
  await write(join(DIST, 'robots.txt'), robots);

  // Depois de gravar tudo, nunca antes: o que fica no ar durante a passada e o
  // site anterior inteiro, e o que sai e so o que o acervo nao contem mais.
  const pruned = [...(await pruneArticles(pages)), ...(await pruneOgImages(ogPaths.wanted))];

  console.log(
    `prerender: ${pages.length} páginas, 404.html, sitemap.xml e robots.txt em ${DIST}/; ` +
      `${ogPaths.drawn} cartões desenhados, ${ogPaths.wanted.size - ogPaths.drawn} reaproveitados` +
      (pruned.length > 0 ? `; podados: ${pruned.join(', ')}` : ''),
  );
}

await main();

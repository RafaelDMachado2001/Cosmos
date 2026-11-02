import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { ogImagePath } from '../core/og';
import type { OgCard } from '../core/og';
import { stalePages } from '../core/prune';
import { snapshotPath } from '../core/snapshot';
import { articlePath, homePath } from '../core/routing';
import { DEFAULT_LOCALE, LOCALES } from '../core/types';
import { PUBLICATIONS } from '../data/publications';
import { createHttpSource, createStaticSource } from '../data/PublicationsSource';
import { missingAssets } from './assets';
import { SLOT, compose } from './compose';
import { apiUrlFrom, distDir, templateDir } from './config';
import { ogPng } from './og';
import { prerenderPages } from './pages';
import type { PrerenderedPage } from './pages';

const DIST = distDir(process.env);
const TEMPLATE_DIR = templateDir(process.env);
const SSR_DIR = 'dist-ssr';

const OG_DIR = 'og';

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

async function write(path: string, contents: string | Uint8Array): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, contents);
  await rename(temporary, path);
}

async function readTemplate(): Promise<{ html: string; path: string }> {
  const sidecar = join(TEMPLATE_DIR, 'template.html');
  try {
    return { html: await readFile(sidecar, 'utf8'), path: sidecar };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    const fallback = join(TEMPLATE_DIR, 'index.html');
    return { html: await readFile(fallback, 'utf8'), path: fallback };
  }
}

async function pruneArticles(pages: readonly PrerenderedPage[]): Promise<readonly string[]> {
  const written = new Set(pages.map((page) => page.path.replace(/^\/+/, '')));

  const existing: string[] = [];
  for (const locale of LOCALES) {
    const articles = dirname(articlePath(locale, 'x')).replace(/^\/+/, '');
    let entries;
    try {
      entries = await readdir(join(DIST, articles), { withFileTypes: true });
    } catch (error) {
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

  if (!template.includes(SLOT)) {
    throw new Error(`${SLOT} não está em ${templatePath} — nada a preencher.`);
  }
  if (!template.includes('</head>')) {
    throw new Error(`${templatePath} sem </head> — não há onde pôr o cabeçalho.`);
  }

  const missing = missingAssets(template, (path) => existsSync(join(DIST, path)));
  if (missing.length > 0) {
    throw new Error(
      `${templatePath} carrega assets que ${DIST}/ não tem: ${missing.join(', ')}. ` +
        'O molde e o destino vêm de builds diferentes.',
    );
  }

  await write(join(SSR_DIR, 'template.html'), template);

  const css = await readStaticCss();
  const apiUrl = apiUrlFrom(process.env);
  const source =
    apiUrl === null
      ? createStaticSource(PUBLICATIONS)
      : createHttpSource(apiUrl, fetch, {
          internalToken: process.env.PRERENDER_INTERNAL_TOKEN ?? null,
        });
  const { pages, notFound, sitemap, robots, rss, snapshot } = await prerenderPages(source);

  const ogPaths = await drawOgImages(pages);

  for (const page of pages) {
    await write(join(DIST, page.path, 'index.html'), compose(template, page, css));
  }

  const root = pages.find((page) => page.path === homePath(DEFAULT_LOCALE));
  if (root === undefined) {
    throw new Error(`prerender sem a raiz de ${DEFAULT_LOCALE}: ${DIST}/index.html ficaria cru.`);
  }
  await write(join(DIST, 'index.html'), compose(template, root, css));

  await write(join(DIST, notFound.path), compose(template, notFound, css));

  await write(join(DIST, 'sitemap.xml'), sitemap);
  await write(join(DIST, 'robots.txt'), robots);
  for (const locale of LOCALES) {
    await write(join(DIST, locale, 'rss.xml'), rss[locale]);
  }
  for (const locale of LOCALES) {
    await write(join(DIST, snapshotPath(locale).slice(1)), snapshot[locale]);
  }

  const pruned = [...(await pruneArticles(pages)), ...(await pruneOgImages(ogPaths.wanted))];

  console.log(
    `prerender: ${pages.length} páginas, 404.html, sitemap.xml, robots.txt, rss.xml e snapshot por idioma em ${DIST}/; ` +
      `${ogPaths.drawn} cartões desenhados, ${ogPaths.wanted.size - ogPaths.drawn} reaproveitados` +
      (pruned.length > 0 ? `; podados: ${pruned.join(', ')}` : ''),
  );
}

await main();

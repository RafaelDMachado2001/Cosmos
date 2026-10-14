/**
 * O `sitemap.xml` e o `robots.txt`, gerados do acervo.
 *
 * O handoff pede o sitemap "a partir das publicações publicadas": nada aqui é
 * escrito à mão, pelo mesmo motivo que nenhuma coordenada de estrela é. Publicar
 * um item novo deve bastar.
 *
 * Módulo puro: sem DOM, sem React, sem Three.
 */

import { articlePath, homePath } from './routing';
import { DEFAULT_LOCALE, LOCALES } from './types';
import type { MetaSite } from './seo';
import type { Locale } from './types';
import { absolute } from './url';

/** O mínimo que uma URL do sitemap precisa saber da publicação. */
export interface SitemapEntry {
  readonly slug: string;
  /** ISO 8601. Vira o `lastmod`, que é uma data, não um instante. */
  readonly publishedAt: string;
}

/** `lastmod` aceita a data sozinha, e é tudo o que se sabe: não há data de revisão. */
function day(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * Uma `<url>` com as suas alternativas.
 *
 * Cada idioma ganha a sua própria entrada, e todas as entradas listam todos os
 * idiomas — inclusive a si mesmas. É o que a especificação de sitemaps pede: o
 * conjunto tem de ser recíproco, senão o buscador descarta os pares.
 */
function urlEntry(origin: string, path: (locale: Locale) => string, locale: Locale, lastmod: string | null): string {
  const alternates = [
    ...LOCALES.map((target) => ({ hreflang: target, href: absolute(origin, path(target)) })),
    { hreflang: 'x-default', href: absolute(origin, path(DEFAULT_LOCALE)) },
  ];

  return [
    '  <url>',
    `    <loc>${absolute(origin, path(locale))}</loc>`,
    ...(lastmod === null ? [] : [`    <lastmod>${lastmod}</lastmod>`]),
    ...alternates.map(
      (alternate) =>
        `    <xhtml:link rel="alternate" hreflang="${alternate.hreflang}" href="${alternate.href}"/>`,
    ),
    '  </url>',
  ].join('\n');
}

export function sitemapXml(site: MetaSite, entries: readonly SitemapEntry[]): string {
  const urls = [
    ...LOCALES.map((locale) => urlEntry(site.origin, homePath, locale, null)),
    ...entries.flatMap((entry) =>
      LOCALES.map((locale) =>
        urlEntry(
          site.origin,
          (target: Locale) => articlePath(target, entry.slug),
          locale,
          day(entry.publishedAt),
        ),
      ),
    ),
  ];

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
}

export function robotsTxt(site: MetaSite): string {
  return `User-agent: *\nAllow: /\n\nSitemap: ${absolute(site.origin, '/sitemap.xml')}\n`;
}

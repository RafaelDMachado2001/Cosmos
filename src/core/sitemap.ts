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
  /** ISO 8601. Vira o `lastmod` quando não há edição depois da publicação. */
  readonly publishedAt: string;
  /**
   * ISO 8601. Maior que `publishedAt` quando o texto foi editado depois de
   * publicado — editar só a tradução não toca a linha da publicação no
   * banco, então o servidor já devolve o maior dos dois. Ausente nas
   * publicações que nunca viram o backend (acervo semente, sintéticas).
   */
  readonly updatedAt?: string;
  /**
   * Os idiomas que de fato têm tradução — uma publicação pode existir só num
   * deles (o formulário do painel permite). Sem isto o sitemap gerava uma
   * `<url>` e um par de `hreflang` reciprocamente para um idioma que nunca
   * foi pré-renderizado: o buscador e o seletor de idioma caíam num 404.
   */
  readonly locales: readonly Locale[];
  /** `false` tira a publicação do sitemap sem tirá-la do ar. Default `true`. */
  readonly indexable?: boolean;
}

/** `lastmod` aceita a data sozinha, e é tudo o que se sabe: não há hora de revisão. */
function day(iso: string): string {
  return iso.slice(0, 10);
}

/** O mais recente dos dois, como dia — nunca o de publicação sozinho se houve edição depois. */
function lastmod(entry: SitemapEntry): string {
  if (entry.updatedAt === undefined) return day(entry.publishedAt);
  return day(Date.parse(entry.updatedAt) > Date.parse(entry.publishedAt) ? entry.updatedAt : entry.publishedAt);
}

/**
 * Uma `<url>` com as suas alternativas.
 *
 * Cada idioma ganha a sua própria entrada, e todas as entradas listam todos os
 * idiomas disponíveis — inclusive a si mesmas. É o que a especificação de
 * sitemaps pede: o conjunto tem de ser recíproco, senão o buscador descarta os
 * pares. `locales` restringe a quais — uma publicação num só idioma não tem
 * par para anunciar.
 */
function urlEntry(
  origin: string,
  path: (locale: Locale) => string,
  locale: Locale,
  lastmod: string | null,
  locales: readonly Locale[],
): string {
  // x-default aponta para o idioma padrão quando ele existe; senão, para
  // qualquer um dos que existem — nunca para um idioma ausente.
  const defaultTarget = locales.includes(DEFAULT_LOCALE) ? DEFAULT_LOCALE : locales[0];
  const alternates = [
    ...locales.map((target) => ({ hreflang: target, href: absolute(origin, path(target)) })),
    ...(defaultTarget === undefined
      ? []
      : [{ hreflang: 'x-default', href: absolute(origin, path(defaultTarget)) }]),
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
    ...LOCALES.map((locale) => urlEntry(site.origin, homePath, locale, null, LOCALES)),
    ...entries
      .filter((entry) => entry.indexable !== false)
      .flatMap((entry) =>
        entry.locales.map((locale) =>
          urlEntry(
            site.origin,
            (target: Locale) => articlePath(target, entry.slug),
            locale,
            lastmod(entry),
            entry.locales,
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

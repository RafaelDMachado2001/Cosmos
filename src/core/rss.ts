/**
 * O feed RSS 2.0, um por idioma, gerado do acervo.
 *
 * Mesmo princípio do `core/sitemap.ts`: nada escrito à mão, publicar um item
 * novo deve bastar. Sem o corpo completo do artigo no feed — o resumo já
 * existe, e o corpo exigiria decidir se um leitor de RSS também interpreta
 * blocos de `core/blocks.ts`; essa decisão não foi pedida.
 *
 * Módulo puro: sem DOM, sem React, sem Three.
 */

import { articlePath, homePath } from './routing';
import { LOCALE_TAG } from './types';
import type { Locale } from './types';
import { absolute } from './url';

/** O mínimo que um `<item>` do feed precisa saber da publicação. */
export interface RssEntry {
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  /** ISO 8601. Vira o `pubDate`, em RFC 822. */
  readonly publishedAt: string;
}

/** O que descreve o canal — o acervo como um todo, não uma publicação. */
export interface RssChannel {
  readonly title: string;
  readonly description: string;
}

/**
 * Os cinco caracteres que o XML reserva. Sem isto, um título ou resumo com
 * `&`, `<` ou `>` quebraria o documento — o mesmo problema que `core/seo.ts`
 * resolve para o `<head>`, aqui para o feed.
 */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** RFC 822, como `pubDate` exige. `Date` sempre devolve em UTC aqui, nunca no fuso de quem gera. */
function pubDate(iso: string): string {
  return new Date(iso).toUTCString();
}

function item(origin: string, locale: Locale, entry: RssEntry): string {
  const link = absolute(origin, articlePath(locale, entry.slug));
  return [
    '    <item>',
    `      <title>${escapeXml(entry.title)}</title>`,
    `      <link>${link}</link>`,
    `      <guid isPermaLink="true">${link}</guid>`,
    `      <description>${escapeXml(entry.summary)}</description>`,
    `      <pubDate>${pubDate(entry.publishedAt)}</pubDate>`,
    '    </item>',
  ].join('\n');
}

export function rssXml(
  origin: string,
  locale: Locale,
  channel: RssChannel,
  entries: readonly RssEntry[],
): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    '  <channel>',
    `    <title>${escapeXml(channel.title)}</title>`,
    `    <link>${absolute(origin, homePath(locale))}</link>`,
    `    <description>${escapeXml(channel.description)}</description>`,
    // O mesmo código BCP 47 do `lang` da página: o leitor de RSS escolhe
    // hifenização e voz de leitura por ele.
    `    <language>${LOCALE_TAG[locale]}</language>`,
    ...entries.map((entry) => item(origin, locale, entry)),
    '  </channel>',
    '</rss>',
    '',
  ].join('\n');
}

import { articlePath, homePath } from './routing';
import { LOCALE_TAG } from './types';
import type { Locale } from './types';
import { absolute } from './url';

export interface RssEntry {
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly publishedAt: string;
}

export interface RssChannel {
  readonly title: string;
  readonly description: string;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

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
    `    <language>${LOCALE_TAG[locale]}</language>`,
    ...entries.map((entry) => item(origin, locale, entry)),
    '  </channel>',
    '</rss>',
    '',
  ].join('\n');
}

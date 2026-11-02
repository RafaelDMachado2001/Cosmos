import { articlePath, homePath } from './routing';
import { DEFAULT_LOCALE, LOCALES } from './types';
import type { MetaSite } from './seo';
import type { Locale } from './types';
import { absolute } from './url';

export interface SitemapEntry {
  readonly slug: string;
  readonly publishedAt: string;
  readonly updatedAt?: string;
  readonly locales: readonly Locale[];
  readonly indexable?: boolean;
}

function day(iso: string): string {
  return iso.slice(0, 10);
}

function lastmod(entry: SitemapEntry): string {
  if (entry.updatedAt === undefined) return day(entry.publishedAt);
  return day(Date.parse(entry.updatedAt) > Date.parse(entry.publishedAt) ? entry.updatedAt : entry.publishedAt);
}

function urlEntry(
  origin: string,
  path: (locale: Locale) => string,
  locale: Locale,
  lastmod: string | null,
  locales: readonly Locale[],
): string {
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

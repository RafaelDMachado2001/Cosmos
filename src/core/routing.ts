import { LOCALES, isLocale } from './types';
import type { Locale } from './types';

export const ARTICLE_SEGMENT: Record<Locale, string> = {
  pt: 'publicacoes',
  en: 'publications',
};

export type Route =
  | { readonly kind: 'home'; readonly locale: Locale | null }
  | { readonly kind: 'article'; readonly locale: Locale; readonly slug: string }
  | { readonly kind: 'notfound' };

const NOT_FOUND: Route = { kind: 'notfound' };

function decodeSlug(raw: string): string | null {
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

export function parseRoute(pathname: string): Route {
  const segments = pathname.split('/').filter((segment) => segment !== '');

  if (segments.length === 0) return { kind: 'home', locale: null };

  const [first, second, third] = segments;
  if (!isLocale(first)) return NOT_FOUND;

  if (segments.length === 1) return { kind: 'home', locale: first };

  if (segments.length !== 3 || second !== ARTICLE_SEGMENT[first]) return NOT_FOUND;

  const slug = decodeSlug(third ?? '');
  if (slug === null || slug === '') return NOT_FOUND;

  return { kind: 'article', locale: first, slug };
}

export function articlePath(locale: Locale, slug: string): string {
  return `/${locale}/${ARTICLE_SEGMENT[locale]}/${encodeURIComponent(slug)}`;
}

export function homePath(locale: Locale): string {
  return `/${locale}`;
}

export function rssPath(locale: Locale): string {
  return `/${locale}/rss.xml`;
}

export function otherLocale(locale: Locale): Locale {
  return LOCALES.find((candidate) => candidate !== locale) ?? locale;
}

export type CloseTarget =
  | { readonly kind: 'back' }
  | { readonly kind: 'replace'; readonly path: string };

export function closeTarget(ownsEntry: boolean, locale: Locale): CloseTarget {
  return ownsEntry ? { kind: 'back' } : { kind: 'replace', path: homePath(locale) };
}

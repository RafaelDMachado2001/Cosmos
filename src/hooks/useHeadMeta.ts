import { useEffect } from 'react';

import { metaKeyAttribute } from '../core/seo';
import type { JsonLd, PageMeta } from '../core/seo';

const OWNED = 'data-head';

function upsert<E extends HTMLElement>(selector: string, create: () => E): E {
  const existing = document.head.querySelector<E>(selector);
  if (existing) return existing;
  const element = create();
  element.setAttribute(OWNED, '');
  document.head.appendChild(element);
  return element;
}

function setDescription(content: string): void {
  const element = upsert<HTMLMetaElement>('meta[name="description"]', () => {
    const meta = document.createElement('meta');
    meta.name = 'description';
    return meta;
  });
  element.content = content;
}

function setCanonical(href: string): void {
  const element = upsert<HTMLLinkElement>('link[rel="canonical"]', () => {
    const link = document.createElement('link');
    link.rel = 'canonical';
    return link;
  });
  element.href = href;
}

function setProperties(entries: Readonly<Record<string, string>>): void {
  for (const stale of document.head.querySelectorAll(`meta[${OWNED}][property], meta[${OWNED}][name^="twitter:"]`)) {
    stale.remove();
  }
  for (const [property, content] of Object.entries(entries)) {
    if (content === '') continue;
    const meta = document.createElement('meta');
    meta.setAttribute(metaKeyAttribute(property), property);
    meta.setAttribute(OWNED, '');
    meta.content = content;
    document.head.appendChild(meta);
  }
}

function setRssLink(href: string | undefined): void {
  if (href === undefined) {
    document.head.querySelector('link[rel="alternate"][type="application/rss+xml"]')?.remove();
    return;
  }
  const element = upsert<HTMLLinkElement>('link[rel="alternate"][type="application/rss+xml"]', () => {
    const link = document.createElement('link');
    link.rel = 'alternate';
    link.type = 'application/rss+xml';
    link.title = 'RSS';
    return link;
  });
  element.href = href;
}

function setAlternates(alternates: PageMeta['alternates']): void {
  for (const stale of document.head.querySelectorAll('link[rel="alternate"][hreflang]')) {
    stale.remove();
  }
  for (const alternate of alternates) {
    const link = document.createElement('link');
    link.rel = 'alternate';
    link.hreflang = alternate.hreflang;
    link.href = alternate.href;
    link.setAttribute(OWNED, '');
    document.head.appendChild(link);
  }
}

function setJsonLd(data: JsonLd | null): void {
  const existing = document.head.querySelector('script[type="application/ld+json"]');
  if (data === null) {
    existing?.remove();
    return;
  }
  const script = existing ?? document.createElement('script');
  script.setAttribute('type', 'application/ld+json');
  script.setAttribute(OWNED, '');
  script.textContent = JSON.stringify(data);
  if (!existing) document.head.appendChild(script);
}

export function useHeadMeta(
  meta: PageMeta,
  jsonLd: JsonLd | null,
  localeTag: string,
): void {
  useEffect(() => {
    document.documentElement.lang = localeTag;
    document.title = meta.title;
    setDescription(meta.description);
    setCanonical(meta.canonical);
    setAlternates(meta.alternates);
    setRssLink(meta.rssHref);
    setProperties(meta.og);
    setJsonLd(jsonLd);
  }, [meta, jsonLd, localeTag]);
}

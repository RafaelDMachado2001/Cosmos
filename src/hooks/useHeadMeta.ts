import { useEffect } from 'react';

import type { JsonLd, PageMeta } from '../core/seo';

/**
 * Marca as tags que esta camada governa.
 *
 * É um contrato com o prerender: o HTML gravado no build emite o mesmo atributo
 * nas mesmas tags, para que a primeira sincronização no cliente as reaproveite
 * em vez de acrescentar um segundo canonical ao lado do que já veio do servidor.
 */
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

/**
 * Os `og:` e os `article:` são reescritos do zero a cada mudança.
 *
 * Reaproveitar tag a tag deixaria para trás as que a rota anterior tinha e a
 * nova não tem — sair de um artigo para a tela de entrada manteria um
 * `article:published_time` descrevendo um texto que já não está na página.
 */
function setProperties(entries: Readonly<Record<string, string>>): void {
  for (const stale of document.head.querySelectorAll(`meta[${OWNED}][property]`)) {
    stale.remove();
  }
  for (const [property, content] of Object.entries(entries)) {
    if (content === '') continue;
    const meta = document.createElement('meta');
    meta.setAttribute('property', property);
    meta.setAttribute(OWNED, '');
    meta.content = content;
    document.head.appendChild(meta);
  }
}

/** Só a home tem — sai do `<head>` ao navegar para um artigo, sem ficar para trás. */
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

/**
 * Mantém o `<head>` de acordo com a rota aberta.
 *
 * O que vai aqui é decidido em `src/core/seo.ts`, testado e sem DOM; este hook
 * só escreve. A divisão é o que permite ao prerender produzir exatamente o
 * mesmo cabeçalho no build, a partir da mesma função.
 */
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

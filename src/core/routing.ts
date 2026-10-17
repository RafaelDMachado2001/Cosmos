/**
 * As rotas públicas.
 *
 * O caminho de um artigo é traduzido junto com o conteúdo — `/pt/publicacoes/`
 * e `/en/publications/` — então o segmento é parte do vocabulário, não uma
 * constante de infraestrutura. Cruzar os dois (`/pt/publications/…`) não é uma
 * rota: seria uma segunda URL para o mesmo artigo, e o canonical passaria a
 * depender de qual delas o rastreador viu primeiro.
 *
 * Este módulo é o dono único desse mapa. A constelação monta os `href` por
 * aqui, o prerender decide onde gravar cada arquivo por aqui, e o sitemap lista
 * por aqui — se o segmento mudar, muda em um lugar só.
 *
 * Módulo puro: sem DOM, sem React, sem Three.
 */

import { LOCALES, isLocale } from './types';
import type { Locale } from './types';

/** O segmento traduzido que precede o slug, por idioma. */
export const ARTICLE_SEGMENT: Record<Locale, string> = {
  pt: 'publicacoes',
  en: 'publications',
};

export type Route =
  /** `locale` é `null` na raiz: ali a URL não diz o idioma e quem decide é a preferência salva. */
  | { readonly kind: 'home'; readonly locale: Locale | null }
  | { readonly kind: 'article'; readonly locale: Locale; readonly slug: string }
  | { readonly kind: 'notfound' };

const NOT_FOUND: Route = { kind: 'notfound' };

/**
 * Um slug percent-encoded inválido não é motivo para derrubar o boot.
 *
 * `decodeURIComponent` lança em `%E0%A4%A`, e essa chamada acontece na primeira
 * renderização, antes de qualquer error boundary existir. Uma sequência quebrada
 * é uma URL que ninguém publicou: vira 404, como qualquer outro endereço errado.
 */
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

/** Onde o feed RSS daquele idioma é gravado e servido — um por idioma. */
export function rssPath(locale: Locale): string {
  return `/${locale}/rss.xml`;
}

/** O outro idioma — o par de `hreflang` de qualquer rota tem exatamente dois lados. */
export function otherLocale(locale: Locale): Locale {
  return LOCALES.find((candidate) => candidate !== locale) ?? locale;
}

/**
 * Onde o fechamento do leitor deve levar.
 *
 * Abrir uma estrela empilha uma entrada, então fechar é literalmente voltar: o
 * botão do navegador e o "×" passam a fazer a mesma coisa, e o avançar reabre o
 * artigo. Numa chegada direta — alguém abriu o link do artigo — não há para
 * onde voltar dentro do site, e um `back` ali levaria a pessoa para fora. Esse
 * caso troca a entrada atual pela raiz do idioma: o "×" fica no site e o voltar
 * continua indo para onde a pessoa realmente estava antes.
 */
export type CloseTarget =
  | { readonly kind: 'back' }
  | { readonly kind: 'replace'; readonly path: string };

export function closeTarget(ownsEntry: boolean, locale: Locale): CloseTarget {
  return ownsEntry ? { kind: 'back' } : { kind: 'replace', path: homePath(locale) };
}

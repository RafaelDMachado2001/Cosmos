/**
 * O `<head>` de cada rota: canonical, hreflang, Open Graph e JSON-LD.
 *
 * A constelação é uma camada por cima — o handoff é explícito: "a camada 3D não
 * pode esconder o conteúdo dos buscadores". Este módulo descreve o cabeçalho,
 * sem aplicá-lo: quem aplica é o efeito no cliente e, no build, o prerender.
 * Os dois precisam produzir exatamente o mesmo cabeçalho, e a única forma de
 * garantir isso é os dois lerem da mesma função.
 *
 * Módulo puro: sem DOM, sem React, sem Three.
 */

import { OG_SIZE, ogImagePath } from './og';
import type { OgCard } from './og';
import { articlePath, homePath, rssPath } from './routing';
import { DEFAULT_LOCALE, LOCALES, LOCALE_TAG, OG_LOCALE } from './types';
import type { Category, Locale } from './types';
import { absolute } from './url';

export interface MetaSite {
  /** URL absoluta do site, com ou sem barra final. */
  readonly origin: string;
  readonly siteName: string;
  readonly authorName: string;
}

export interface MetaArticle {
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  /** ISO 8601, como vem do acervo. */
  readonly publishedAt: string;
  readonly categoryLabel: string;
  /** Pinta o acento do cartão de Open Graph. */
  readonly category: Category;
  /** Sobrepõe `title`/`summary` no `<title>`, na meta description e no Open Graph. */
  readonly seoTitle?: string;
  readonly seoDescription?: string;
  /** `false` tira a página do índice de busca — ver `PublicationInput.indexable`. */
  readonly indexable?: boolean;
}

export interface Alternate {
  readonly hreflang: string;
  readonly href: string;
}

export interface PageMeta {
  readonly title: string;
  readonly description: string;
  readonly canonical: string;
  readonly alternates: readonly Alternate[];
  readonly og: Readonly<Record<string, string>>;
  /**
   * O feed RSS deste idioma, para autodescoberta por agregador/leitor.
   *
   * Só na home: é onde a convenção espera o `<link>`, e repetir em toda
   * página de artigo não acrescenta nada que a home já não anuncie.
   */
  readonly rssHref?: string;
  /** `'noindex'` quando `MetaArticle.indexable` é `false`. Ausente em todo o resto. */
  readonly robots?: string;
}

export interface ArticleJsonLd {
  readonly '@context': string;
  readonly '@type': string;
  readonly headline: string;
  readonly description: string;
  readonly datePublished: string;
  readonly inLanguage: string;
  readonly articleSection: string;
  readonly url: string;
  readonly mainEntityOfPage: { readonly '@type': string; readonly '@id': string };
  readonly author: { readonly '@type': string; readonly name: string };
}

/**
 * Os idiomas disponíveis mais o `x-default`.
 *
 * `locales` default para os dois — a home sempre tem ambos. Um artigo pode
 * existir só num idioma (o painel permite); sem restringir aqui, o
 * `<head>` anunciava um par para uma página que o prerender nunca gravou.
 *
 * `x-default` é obrigatório quando não há uma versão neutra: sem ele o
 * buscador escolhe sozinho qual servir a quem não pede nenhum dos dois. Cai
 * no idioma padrão quando ele existe, senão no único disponível.
 */
function alternatesFor(
  origin: string,
  path: (locale: Locale) => string,
  locales: readonly Locale[] = LOCALES,
): readonly Alternate[] {
  const defaultTarget = locales.includes(DEFAULT_LOCALE) ? DEFAULT_LOCALE : locales[0];
  return [
    ...locales.map((locale) => ({ hreflang: locale, href: absolute(origin, path(locale)) })),
    ...(defaultTarget === undefined
      ? []
      : [{ hreflang: 'x-default', href: absolute(origin, path(defaultTarget)) }]),
  ];
}

/** Os idiomas disponíveis que não são este — o Open Graph lista um a um. */
function otherOgLocales(locale: Locale, locales: readonly Locale[] = LOCALES): string {
  return locales
    .filter((candidate) => candidate !== locale)
    .map((candidate) => OG_LOCALE[candidate])
    .join(',');
}

/** O cartão que representa o artigo quando o link é compartilhado. */
export function articleOgCard(locale: Locale, article: MetaArticle): OgCard {
  return {
    locale,
    title: article.title,
    kicker: article.categoryLabel,
    category: article.category,
    date: article.publishedAt.slice(0, 10),
  };
}

/** O da home: sem categoria nem data, com o nome do site na linha de cima. */
export function homeOgCard(
  site: MetaSite,
  locale: Locale,
  copy: { readonly title: string },
): OgCard {
  return { locale, title: copy.title, kicker: site.siteName };
}

/**
 * As tags da imagem. Absoluta porque quem a lê é o robô de outro site, que não
 * resolve caminho relativo; o `alt` repete o título, que é o que ela mostra.
 */
function ogImageTags(site: MetaSite, card: OgCard): Readonly<Record<string, string>> {
  return {
    'og:image': absolute(site.origin, ogImagePath(card)),
    'og:image:width': String(OG_SIZE.width),
    'og:image:height': String(OG_SIZE.height),
    'og:image:alt': card.title,
  };
}

export function articleMeta(
  site: MetaSite,
  locale: Locale,
  article: MetaArticle,
  /**
   * Os idiomas que de fato têm tradução deste artigo. Default para os dois
   * porque o cliente (`App.tsx`) ainda não sabe dizer — o contrato da API
   * não expõe essa informação fora da lista, só o prerender, que já tem as
   * duas listas completas antes de montar qualquer página.
   */
  locales: readonly Locale[] = LOCALES,
): PageMeta {
  const path = (target: Locale): string => articlePath(target, article.slug);
  const canonical = absolute(site.origin, path(locale));
  const title = article.seoTitle ?? article.title;
  const description = article.seoDescription ?? article.summary;

  return {
    // O título da aba leva o nome do site; o do Open Graph não, porque ali o
    // cartão já mostra o domínio embaixo e repetir encurta o que se lê.
    title: `${title} · ${site.siteName}`,
    description,
    canonical,
    alternates: alternatesFor(site.origin, path, locales),
    ...(article.indexable === false ? { robots: 'noindex' } : {}),
    og: {
      'og:type': 'article',
      'og:url': canonical,
      'og:title': title,
      'og:description': description,
      'og:site_name': site.siteName,
      'og:locale': OG_LOCALE[locale],
      'og:locale:alternate': otherOgLocales(locale, locales),
      'article:published_time': article.publishedAt,
      'article:section': article.categoryLabel,
      ...ogImageTags(site, articleOgCard(locale, article)),
    },
  };
}

export function homeMeta(
  site: MetaSite,
  locale: Locale,
  copy: { readonly title: string; readonly description: string },
): PageMeta {
  const canonical = absolute(site.origin, homePath(locale));

  return {
    title: copy.title,
    description: copy.description,
    canonical,
    alternates: alternatesFor(site.origin, homePath),
    og: {
      'og:type': 'website',
      'og:url': canonical,
      'og:title': copy.title,
      'og:description': copy.description,
      'og:site_name': site.siteName,
      'og:locale': OG_LOCALE[locale],
      'og:locale:alternate': otherOgLocales(locale),
      ...ogImageTags(site, homeOgCard(site, locale, copy)),
    },
    rssHref: absolute(site.origin, rssPath(locale)),
  };
}

/**
 * O `Article` que vai no `<script type="application/ld+json">`.
 *
 * Só o artigo tem JSON-LD: a tela de entrada não é um documento indexável, é
 * uma porta. Descrevê-la como `Article` prometeria um texto que não existe.
 */
export function articleJsonLd(
  site: MetaSite,
  locale: Locale,
  article: MetaArticle,
): ArticleJsonLd {
  const url = absolute(site.origin, articlePath(locale, article.slug));

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.summary,
    datePublished: article.publishedAt,
    inLanguage: LOCALE_TAG[locale],
    articleSection: article.categoryLabel,
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    author: { '@type': 'Person', name: site.authorName },
  };
}

// ---------------------------------------------------------------------------
// Serialização
//
// O cliente escreve o cabeçalho pelo DOM; o prerender precisa dele como texto,
// no build, onde não há DOM nenhum. As duas saídas nascem do mesmo `PageMeta` —
// é o que impede o HTML gravado no disco de divergir do que o React monta por
// cima dele.
// ---------------------------------------------------------------------------

/** Escapa o que entra em valor de atributo. */
function attr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Escapa o que entra em texto de elemento. */
function text(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * O JSON-LD dentro de um `<script>` não é JSON, é HTML contendo JSON.
 *
 * Um `</script>` no meio de um título fecharia a tag ali mesmo e o resto do
 * grafo viraria marcação executável. Escapar o `<` resolve sem alterar o valor:
 * `\u003c` é o mesmo caractere para qualquer leitor de JSON.
 */
function jsonLdText(data: ArticleJsonLd): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export function renderHeadTags(meta: PageMeta, jsonLd: ArticleJsonLd | null): string {
  const lines = [
    `<title>${text(meta.title)}</title>`,
    `<meta name="description" data-head content="${attr(meta.description)}">`,
    `<link rel="canonical" data-head href="${attr(meta.canonical)}">`,
    ...(meta.robots === undefined
      ? []
      : [`<meta name="robots" data-head content="${attr(meta.robots)}">`]),
    ...meta.alternates.map(
      (alternate) =>
        `<link rel="alternate" data-head hreflang="${attr(alternate.hreflang)}" href="${attr(alternate.href)}">`,
    ),
    ...(meta.rssHref === undefined
      ? []
      : [
          `<link rel="alternate" data-head type="application/rss+xml" title="RSS" href="${attr(meta.rssHref)}">`,
        ]),
    ...Object.entries(meta.og)
      .filter(([, content]) => content !== '')
      .map(
        ([property, content]) =>
          `<meta property="${attr(property)}" data-head content="${attr(content)}">`,
      ),
  ];

  if (jsonLd !== null) {
    lines.push(`<script type="application/ld+json" data-head>${jsonLdText(jsonLd)}</script>`);
  }

  return lines.join('\n');
}

/**
 * O cabeçalho de um endereço que não existe.
 *
 * Sem canonical e sem `hreflang`: os dois afirmam que a página é a versão
 * legítima de algum conteúdo, e aqui não há conteúdo nenhum. O `noindex` é o
 * que impede o endereço errado de entrar no índice junto com o certo.
 */
export function notFoundHeadTags(title: string, description: string): string {
  return [
    `<title>${text(title)}</title>`,
    `<meta name="description" data-head content="${attr(description)}">`,
    '<meta name="robots" data-head content="noindex">',
  ].join('\n');
}

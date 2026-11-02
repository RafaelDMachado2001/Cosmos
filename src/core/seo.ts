import { OG_SIZE, ogImagePath } from './og';
import type { OgCard } from './og';
import { articlePath, homePath, rssPath } from './routing';
import { DEFAULT_LOCALE, LOCALES, LOCALE_TAG, OG_LOCALE } from './types';
import type { Category, Locale } from './types';
import { absolute } from './url';

export interface MetaSite {
  readonly origin: string;
  readonly siteName: string;
  readonly authorName: string;
  readonly authorUrl?: string;
  readonly authorSameAs?: readonly string[];
  readonly logoPath?: string;
}

export interface MetaArticle {
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly publishedAt: string;
  readonly updatedAt?: string;
  readonly categoryLabel: string;
  readonly category: Category;
  readonly seoTitle?: string;
  readonly seoDescription?: string;
  readonly indexable?: boolean;
  readonly wordCount?: number;
}

export interface MetaPost {
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly publishedAt: string;
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
  readonly rssHref?: string;
  readonly robots?: string;
}

export type JsonLdNode = Readonly<Record<string, unknown>> & { readonly '@type': string };

export interface JsonLd {
  readonly '@context': 'https://schema.org';
  readonly '@graph': readonly JsonLdNode[];
}

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

function otherOgLocales(locale: Locale, locales: readonly Locale[] = LOCALES): string {
  return locales
    .filter((candidate) => candidate !== locale)
    .map((candidate) => OG_LOCALE[candidate])
    .join(',');
}

export function articleOgCard(locale: Locale, article: MetaArticle): OgCard {
  return {
    locale,
    title: article.title,
    kicker: article.categoryLabel,
    category: article.category,
    date: article.publishedAt.slice(0, 10),
  };
}

export function homeOgCard(
  site: MetaSite,
  locale: Locale,
  copy: { readonly title: string },
): OgCard {
  return { locale, title: copy.title, kicker: site.siteName };
}

function ogImageTags(site: MetaSite, card: OgCard): Readonly<Record<string, string>> {
  return {
    'twitter:card': 'summary_large_image',
    'twitter:image': absolute(site.origin, ogImagePath(card)),
    'twitter:image:alt': card.title,
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
  locales: readonly Locale[] = LOCALES,
): PageMeta {
  const path = (target: Locale): string => articlePath(target, article.slug);
  const canonical = absolute(site.origin, path(locale));
  const title = article.seoTitle ?? article.title;
  const description = article.seoDescription ?? article.summary;

  return {
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
      'twitter:title': title,
      'twitter:description': description,
      'og:site_name': site.siteName,
      'og:locale': OG_LOCALE[locale],
      'og:locale:alternate': otherOgLocales(locale, locales),
      'article:published_time': article.publishedAt,
      ...(isEdited(article) ? { 'article:modified_time': article.updatedAt } : {}),
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
      'twitter:title': copy.title,
      'twitter:description': copy.description,
      'og:site_name': site.siteName,
      'og:locale': OG_LOCALE[locale],
      'og:locale:alternate': otherOgLocales(locale),
      ...ogImageTags(site, homeOgCard(site, locale, copy)),
    },
    rssHref: absolute(site.origin, rssPath(locale)),
  };
}

export function articleJsonLd(site: MetaSite, locale: Locale, article: MetaArticle): JsonLd {
  const url = absolute(site.origin, articlePath(locale, article.slug));
  const home = absolute(site.origin, homePath(locale));

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BlogPosting',
        headline: article.title,
        description: article.summary,
        datePublished: article.publishedAt,
        dateModified: article.updatedAt ?? article.publishedAt,
        inLanguage: LOCALE_TAG[locale],
        articleSection: article.categoryLabel,
        url,
        mainEntityOfPage: { '@type': 'WebPage', '@id': url },
        image: absolute(site.origin, ogImagePath(articleOgCard(locale, article))),
        ...(article.wordCount === undefined ? {} : { wordCount: article.wordCount }),
        author: author(site),
        publisher: publisher(site),
        isPartOf: { '@type': 'Blog', '@id': home },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: site.siteName, item: home },
          { '@type': 'ListItem', position: 2, name: article.title, item: url },
        ],
      },
    ],
  };
}

function isEdited(article: MetaArticle): article is MetaArticle & { readonly updatedAt: string } {
  return (
    article.updatedAt !== undefined &&
    Date.parse(article.updatedAt) > Date.parse(article.publishedAt)
  );
}

function author(site: MetaSite): JsonLdNode {
  return {
    '@type': 'Person',
    name: site.authorName,
    ...(site.authorUrl === undefined ? {} : { url: site.authorUrl }),
    ...(site.authorSameAs === undefined ? {} : { sameAs: site.authorSameAs }),
  };
}

function publisher(site: MetaSite): JsonLdNode {
  return {
    '@type': 'Organization',
    name: site.siteName,
    url: absolute(site.origin, '/'),
    ...(site.logoPath === undefined
      ? {}
      : { logo: { '@type': 'ImageObject', url: absolute(site.origin, site.logoPath) } }),
  };
}

export function homeJsonLd(
  site: MetaSite,
  locale: Locale,
  copy: { readonly title: string; readonly description: string },
  posts: readonly MetaPost[],
): JsonLd {
  const url = absolute(site.origin, homePath(locale));

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        name: site.siteName,
        description: copy.description,
        url,
        inLanguage: LOCALE_TAG[locale],
        publisher: publisher(site),
      },
      {
        '@type': 'Blog',
        '@id': url,
        name: copy.title,
        description: copy.description,
        url,
        inLanguage: LOCALE_TAG[locale],
        author: author(site),
        blogPost: posts.map((post) => ({
          '@type': 'BlogPosting',
          headline: post.title,
          description: post.summary,
          datePublished: post.publishedAt,
          url: absolute(site.origin, articlePath(locale, post.slug)),
        })),
      },
    ],
  };
}

export function metaKeyAttribute(key: string): 'name' | 'property' {
  return key.startsWith('twitter:') ? 'name' : 'property';
}

function attr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function text(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function jsonLdText(data: JsonLd): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export function renderHeadTags(meta: PageMeta, jsonLd: JsonLd | null): string {
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
          `<meta ${metaKeyAttribute(property)}="${attr(property)}" data-head content="${attr(content)}">`,
      ),
  ];

  if (jsonLd !== null) {
    lines.push(`<script type="application/ld+json" data-head>${jsonLdText(jsonLd)}</script>`);
  }

  return lines.join('\n');
}

export function notFoundHeadTags(title: string, description: string): string {
  return [
    `<title>${text(title)}</title>`,
    `<meta name="description" data-head content="${attr(description)}">`,
    '<meta name="robots" data-head content="noindex">',
  ].join('\n');
}

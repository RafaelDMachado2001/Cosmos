import { useMemo } from 'react';

import { parseBlocks } from '../core/blocks';
import type { ReaderState } from '../core/reader';
import { wordCount } from '../core/readingTime';
import { articleJsonLd, articleMeta, homeJsonLd, homeMeta } from '../core/seo';
import type { MetaArticle } from '../core/seo';
import { LOCALES } from '../core/types';
import type { Locale, PublicationSummary } from '../core/types';
import type { Dictionary } from '../i18n/pt';
import { SITE } from '../site';
import { useHeadMeta } from './useHeadMeta';
import type { ArticleState } from './usePublications';

export function usePageHead(
  reader: ReaderState,
  article: ArticleState,
  locale: Locale,
  t: Dictionary,
  posts: readonly PublicationSummary[],
): void {
  const metaArticle = useMemo<MetaArticle | null>(() => {
    if (reader.phase === 'closed' || reader.phase === 'closing') return null;
    if (article.status !== 'ready' || article.detail.slug !== reader.slug) return null;
    const { detail } = article;

    return {
      slug: detail.slug,
      title: detail.title,
      summary: detail.summary,
      publishedAt: detail.publishedAt,
      ...(detail.updatedAt === undefined ? {} : { updatedAt: detail.updatedAt }),
      categoryLabel: t.categories[detail.category],
      category: detail.category,
      ...(detail.seoTitle === undefined ? {} : { seoTitle: detail.seoTitle }),
      ...(detail.seoDescription === undefined ? {} : { seoDescription: detail.seoDescription }),
      ...(detail.indexable === undefined ? {} : { indexable: detail.indexable }),
      wordCount: wordCount(parseBlocks(detail.body)),
    };
  }, [reader.phase, reader.slug, article, t]);

  const metaLocales = article.status === 'ready' ? article.detail.locales : LOCALES;

  const pageMeta = useMemo(
    () =>
      metaArticle === null
        ? homeMeta(SITE, locale, t.meta)
        : articleMeta(SITE, locale, metaArticle, metaLocales),
    [metaArticle, metaLocales, locale, t.meta],
  );

  const jsonLd = useMemo(
    () =>
      metaArticle === null
        ? homeJsonLd(SITE, locale, t.meta, posts)
        : articleJsonLd(SITE, locale, metaArticle),
    [metaArticle, locale, t.meta, posts],
  );

  useHeadMeta(pageMeta, jsonLd, t.meta.localeTag);
}

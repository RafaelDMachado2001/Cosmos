import { renderToStaticMarkup } from 'react-dom/server';

import { AccountPage } from '../components/AccountPage/AccountPage';
import { ArticlePage } from '../components/ArticlePage/ArticlePage';
import type { ArticleLink } from '../components/ArticleIndex/ArticleIndex';
import { HomePage } from '../components/HomePage/HomePage';
import { PrivacyPage } from '../components/PrivacyPage/PrivacyPage';
import { parseBlocks } from '../core/blocks';
import { monthYearLabel } from '../core/format';
import { wordCount } from '../core/readingTime';
import { accountPath, articlePath, homePath, otherLocale, privacyPath } from '../core/routing';
import { LOADING } from '../core/session';
import type { OgCard } from '../core/og';
import {
  articleJsonLd,
  homeJsonLd,
  articleMeta,
  articleOgCard,
  homeMeta,
  homeOgCard,
  notFoundHeadTags,
  renderHeadTags,
  staticPageMeta,
} from '../core/seo';
import type { MetaArticle } from '../core/seo';
import { rssXml } from '../core/rss';
import { serializeSnapshot } from '../core/snapshot';
import { robotsTxt, sitemapXml } from '../core/sitemap';
import { LOCALES, LOCALE_TAG } from '../core/types';
import type { Locale, PublicationSummary } from '../core/types';
import { createSource } from '../data/source';
import type { PublicationsSource } from '../data/PublicationsSource';
import { DICTIONARIES } from '../i18n/dictionaries';
import { LocaleProvider } from '../i18n/LocaleProvider';
import { PRIVACY_UPDATED } from '../i18n/privacy';
import { SessionContext } from '../session/SessionContext';
import type { SessionValue } from '../session/SessionContext';
import { SITE } from '../site';

export interface PrerenderedPage {
  readonly path: string;
  readonly lang: string;
  readonly head: string;
  readonly body: string;
  readonly og?: OgCard;
}

export interface PrerenderOutput {
  readonly pages: readonly PrerenderedPage[];
  readonly notFound: PrerenderedPage;
  readonly sitemap: string;
  readonly robots: string;
  readonly rss: Record<Locale, string>;
  readonly snapshot: Record<Locale, string>;
}

export const ARCHIVE_LIMIT = 1000;

function articleIndex(locale: Locale, summaries: readonly PublicationSummary[]): ArticleLink[] {
  const dictionary = DICTIONARIES[locale];
  return summaries.map((summary) => ({
    href: articlePath(locale, summary.slug),
    title: summary.title,
    summary: summary.summary,
    categoryLabel: dictionary.categories[summary.category],
    dateLabel: monthYearLabel(Date.parse(summary.publishedAt), locale),
    publishedAt: summary.publishedAt,
  }));
}

const STATIC_SESSION: SessionValue = {
  state: LOADING,
  exportUrl: null,
  openLogin: () => undefined,
  loginHrefs: () => null,
  retry: () => undefined,
  signOut: () => Promise.resolve(),
  update: () => Promise.reject(new Error('sem sessão no prerender')),
  remove: () => Promise.resolve(),
};

function markup(locale: Locale, node: React.ReactElement): string {
  return renderToStaticMarkup(
    <LocaleProvider initial={locale}>
      <SessionContext.Provider value={STATIC_SESSION}>{node}</SessionContext.Provider>
    </LocaleProvider>,
  );
}

export async function prerenderPages(
  source: PublicationsSource = createSource(),
): Promise<PrerenderOutput> {
  const pages: PrerenderedPage[] = [];
  const listed = new Map<
    string,
    { publishedAt: string; updatedAt?: string; indexable?: boolean }
  >();
  const rss: Partial<Record<Locale, string>> = {};
  const snapshot: Partial<Record<Locale, string>> = {};

  const summariesByLocale = {} as Record<Locale, readonly PublicationSummary[]>;
  const localesForSlug = new Map<string, Locale[]>();
  for (const locale of LOCALES) {
    const summaries = await source.list({ locale, limit: ARCHIVE_LIMIT });
    summariesByLocale[locale] = summaries;
    for (const summary of summaries) {
      localesForSlug.set(summary.slug, [...(localesForSlug.get(summary.slug) ?? []), locale]);
      listed.set(summary.slug, {
        publishedAt: summary.publishedAt,
        ...(summary.updatedAt === undefined ? {} : { updatedAt: summary.updatedAt }),
        ...(summary.indexable === undefined ? {} : { indexable: summary.indexable }),
      });
    }
  }

  for (const locale of LOCALES) {
    const other = otherLocale(locale);
    const dictionary = DICTIONARIES[locale];
    const summaries = summariesByLocale[locale];
    rss[locale] = rssXml(SITE.origin, locale, dictionary.meta, summaries);
    snapshot[locale] = serializeSnapshot(summaries);

    const index = articleIndex(locale, summaries);

    pages.push({
      path: homePath(locale),
      lang: LOCALE_TAG[locale],
      head: renderHeadTags(
        homeMeta(SITE, locale, dictionary.meta),
        homeJsonLd(SITE, locale, dictionary.meta, summaries),
      ),
      og: homeOgCard(SITE, locale, dictionary.meta),
      body: markup(
        locale,
        <HomePage otherLocaleHref={homePath(other)} index={index} />,
      ),
    });

    const homeCard = homeOgCard(SITE, locale, dictionary.meta);
    const titled = (title: string): string => `${title} · ${dictionary.meta.title}`;

    pages.push({
      path: privacyPath(locale),
      lang: LOCALE_TAG[locale],
      head: renderHeadTags(
        staticPageMeta(
          SITE,
          locale,
          privacyPath,
          { title: titled(dictionary.privacy.title), description: dictionary.privacy.description },
          homeCard,
        ),
        null,
      ),
      og: homeCard,
      body: markup(locale, <PrivacyPage otherLocaleHref={privacyPath(other)} />),
    });

    pages.push({
      path: accountPath(locale),
      lang: LOCALE_TAG[locale],
      head: renderHeadTags(
        staticPageMeta(
          SITE,
          locale,
          accountPath,
          { title: titled(dictionary.account.myAccount), description: dictionary.account.anonymous },
          homeCard,
          'noindex',
        ),
        null,
      ),
      og: homeCard,
      body: markup(locale, <AccountPage otherLocaleHref={accountPath(other)} />),
    });

    for (const summary of summaries) {
      const detail = await source.get(summary.slug, locale);
      if (detail === null) continue;

      const meta: MetaArticle = {
        slug: detail.slug,
        title: detail.title,
        summary: detail.summary,
        publishedAt: detail.publishedAt,
        ...(detail.updatedAt === undefined ? {} : { updatedAt: detail.updatedAt }),
        categoryLabel: dictionary.categories[detail.category],
        category: detail.category,
        ...(detail.seoTitle === undefined ? {} : { seoTitle: detail.seoTitle }),
        ...(detail.seoDescription === undefined ? {} : { seoDescription: detail.seoDescription }),
        ...(detail.indexable === undefined ? {} : { indexable: detail.indexable }),
        wordCount: wordCount(parseBlocks(detail.body)),
      };

      const availableLocales = localesForSlug.get(detail.slug) ?? [locale];
      const hasOtherLocale = availableLocales.includes(other);

      pages.push({
        path: articlePath(locale, detail.slug),
        lang: LOCALE_TAG[locale],
        head: renderHeadTags(
          articleMeta(SITE, locale, meta, availableLocales),
          articleJsonLd(SITE, locale, meta),
        ),
        og: articleOgCard(locale, meta),
        body: markup(
          locale,
          <ArticlePage
            category={detail.category}
            categoryLabel={meta.categoryLabel}
            dateLabel={monthYearLabel(Date.parse(detail.publishedAt), locale)}
            publishedAt={detail.publishedAt}
            title={detail.title}
            summary={detail.summary}
            body={detail.body}
            tags={detail.tags}
            homeHref={homePath(locale)}
            otherLocaleHref={hasOtherLocale ? articlePath(other, detail.slug) : null}
            index={index}
          />,
        ),
      });
    }
  }

  const fallbackLocale: Locale = 'pt';
  const fallback = DICTIONARIES[fallbackLocale];
  const fallbackIndex = articleIndex(fallbackLocale, summariesByLocale[fallbackLocale]);

  return {
    pages,
    notFound: {
      path: '/404.html',
      lang: LOCALE_TAG[fallbackLocale],
      head: notFoundHeadTags(
        `${fallback.notFound.title} · ${SITE.siteName}`,
        fallback.notFound.subtitle,
      ),
      body: markup(
        fallbackLocale,
        <HomePage
          otherLocaleHref={homePath(otherLocale(fallbackLocale))}
          index={fallbackIndex}
          notice={{ title: fallback.notFound.title, subtitle: fallback.notFound.subtitle }}
        />,
      ),
    },
    sitemap: sitemapXml(
      SITE,
      [...listed].map(([slug, entry]) => ({
        slug,
        ...entry,
        locales: localesForSlug.get(slug) ?? [],
      })),
      [{ path: privacyPath, lastmod: PRIVACY_UPDATED }],
    ),
    robots: robotsTxt(SITE),
    rss: rss as Record<Locale, string>,
    snapshot: snapshot as Record<Locale, string>,
  };
}

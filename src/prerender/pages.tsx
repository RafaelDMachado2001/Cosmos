import { renderToStaticMarkup } from 'react-dom/server';

import { ArticlePage } from '../components/ArticlePage/ArticlePage';
import type { ArticleLink } from '../components/ArticlePage/ArticlePage';
import { HomePage } from '../components/HomePage/HomePage';
import { monthYearLabel } from '../core/format';
import { articlePath, homePath, otherLocale } from '../core/routing';
import {
  articleJsonLd,
  articleMeta,
  homeMeta,
  notFoundHeadTags,
  renderHeadTags,
} from '../core/seo';
import type { MetaArticle } from '../core/seo';
import { robotsTxt, sitemapXml } from '../core/sitemap';
import { LOCALES, LOCALE_TAG } from '../core/types';
import type { Locale } from '../core/types';
import { createStaticSource } from '../data/PublicationsSource';
import { PUBLICATIONS } from '../data/publications';
import { DICTIONARIES } from '../i18n/dictionaries';
import { LocaleProvider } from '../i18n/LocaleProvider';
import { SITE } from '../site';

/** Uma página pronta para virar arquivo. O caminho é o da URL, sem `index.html`. */
export interface PrerenderedPage {
  readonly path: string;
  /** Vai no `lang` do `<html>`. */
  readonly lang: string;
  /** As tags que entram antes de `</head>`. */
  readonly head: string;
  /** O HTML que preenche `#prerender`. */
  readonly body: string;
}

export interface PrerenderOutput {
  readonly pages: readonly PrerenderedPage[];
  /**
   * A página que o Nginx serve em qualquer 404, com o status correto.
   *
   * Sai no idioma padrão: um endereço que não é rota nenhuma também não diz
   * idioma, e adivinhar pelo `Accept-Language` exigiria lógica no servidor que
   * o arquivo estático não tem. O JavaScript, ao subir, corrige para a
   * preferência de quem lê.
   */
  readonly notFound: PrerenderedPage;
  readonly sitemap: string;
  readonly robots: string;
}

/**
 * Renderiza a casca estática de cada rota.
 *
 * `LocaleProvider` com `initial` nunca consulta `localStorage` nem
 * `navigator` — é o que a torna renderizável aqui, onde não existe navegador.
 * Nada nesta árvore toca DOM, Three ou `requestAnimationFrame`.
 */
function markup(locale: Locale, node: React.ReactElement): string {
  return renderToStaticMarkup(<LocaleProvider initial={locale}>{node}</LocaleProvider>);
}

export async function prerenderPages(): Promise<PrerenderOutput> {
  const source = createStaticSource(PUBLICATIONS);
  const pages: PrerenderedPage[] = [];

  for (const locale of LOCALES) {
    const other = otherLocale(locale);
    const dictionary = DICTIONARIES[locale];
    const summaries = await source.list({ locale });

    const index: readonly ArticleLink[] = summaries.map((summary) => ({
      href: articlePath(locale, summary.slug),
      title: summary.title,
    }));

    pages.push({
      path: homePath(locale),
      lang: LOCALE_TAG[locale],
      head: renderHeadTags(homeMeta(SITE, locale, dictionary.meta), null),
      body: markup(
        locale,
        <HomePage otherLocaleHref={homePath(other)} index={index} />,
      ),
    });

    for (const summary of summaries) {
      // O corpo do texto não vem na lista — ela é enxuta de propósito — e a
      // segunda chamada é a mesma que o cliente faz ao abrir o artigo.
      const detail = await source.get(summary.slug, locale);
      if (detail === null) continue;

      const meta: MetaArticle = {
        slug: detail.slug,
        title: detail.title,
        summary: detail.summary,
        publishedAt: detail.publishedAt,
        categoryLabel: dictionary.categories[detail.category],
      };

      pages.push({
        path: articlePath(locale, detail.slug),
        lang: LOCALE_TAG[locale],
        head: renderHeadTags(
          articleMeta(SITE, locale, meta),
          articleJsonLd(SITE, locale, meta),
        ),
        body: markup(
          locale,
          <ArticlePage
            categoryLabel={meta.categoryLabel}
            dateLabel={monthYearLabel(Date.parse(detail.publishedAt), locale)}
            title={detail.title}
            summary={detail.summary}
            body={detail.body}
            homeHref={homePath(locale)}
            otherLocaleHref={articlePath(other, detail.slug)}
            index={index}
          />,
        ),
      });
    }
  }

  const fallbackLocale: Locale = 'pt';
  const fallback = DICTIONARIES[fallbackLocale];
  const fallbackIndex: readonly ArticleLink[] = (
    await source.list({ locale: fallbackLocale })
  ).map((summary) => ({
    href: articlePath(fallbackLocale, summary.slug),
    title: summary.title,
  }));

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
    // O sitemap lista o acervo, não as páginas: as duas raízes entram por conta
    // dele, e a lista de publicações é a mesma nos dois idiomas.
    sitemap: sitemapXml(
      SITE,
      PUBLICATIONS.map((publication) => ({
        slug: publication.slug,
        publishedAt: publication.publishedAt,
      })),
    ),
    robots: robotsTxt(SITE),
  };
}

import { renderToStaticMarkup } from 'react-dom/server';

import { ArticlePage } from '../components/ArticlePage/ArticlePage';
import type { ArticleLink } from '../components/ArticlePage/ArticlePage';
import { HomePage } from '../components/HomePage/HomePage';
import { monthYearLabel } from '../core/format';
import { articlePath, homePath, otherLocale } from '../core/routing';
import type { OgCard } from '../core/og';
import {
  articleJsonLd,
  articleMeta,
  articleOgCard,
  homeMeta,
  homeOgCard,
  notFoundHeadTags,
  renderHeadTags,
} from '../core/seo';
import type { MetaArticle } from '../core/seo';
import { robotsTxt, sitemapXml } from '../core/sitemap';
import { LOCALES, LOCALE_TAG } from '../core/types';
import type { Locale } from '../core/types';
import { createSource } from '../data/source';
import type { PublicationsSource } from '../data/PublicationsSource';
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
  /** O cartão que o `og:image` do cabeçalho promete. O 404 não tem. */
  readonly og?: OgCard;
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
 * Quanto o prerender pede à fonte: o teto que a API aceita.
 *
 * Sem `limit`, a API devolve 100 e declara o corte, e o adapter HTTP lança —
 * a 101ª publicação derrubaria todo build e todo job. Passar daqui é o que o
 * `truncated` existe para pegar.
 */
export const ARCHIVE_LIMIT = 1000;

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

export async function prerenderPages(
  source: PublicationsSource = createSource(),
): Promise<PrerenderOutput> {
  const pages: PrerenderedPage[] = [];
  /** O acervo como a fonte o devolve — é ele que o sitemap lista. */
  const listed = new Map<string, string>();

  for (const locale of LOCALES) {
    const other = otherLocale(locale);
    const dictionary = DICTIONARIES[locale];
    const summaries = await source.list({ locale, limit: ARCHIVE_LIMIT });
    for (const summary of summaries) listed.set(summary.slug, summary.publishedAt);

    const index: readonly ArticleLink[] = summaries.map((summary) => ({
      href: articlePath(locale, summary.slug),
      title: summary.title,
    }));

    pages.push({
      path: homePath(locale),
      lang: LOCALE_TAG[locale],
      head: renderHeadTags(homeMeta(SITE, locale, dictionary.meta), null),
      og: homeOgCard(SITE, locale, dictionary.meta),
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
        category: detail.category,
      };

      pages.push({
        path: articlePath(locale, detail.slug),
        lang: LOCALE_TAG[locale],
        head: renderHeadTags(
          articleMeta(SITE, locale, meta),
          articleJsonLd(SITE, locale, meta),
        ),
        og: articleOgCard(locale, meta),
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
    await source.list({ locale: fallbackLocale, limit: ARCHIVE_LIMIT })
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
    /*
     * O sitemap lista o que a fonte devolveu, não o acervo semente.
     *
     * Com a API ligada os dois deixam de coincidir no primeiro item publicado
     * pelo painel — e o sitemap é justamente o que precisa refletir o que está
     * no ar. As duas raízes entram por conta dele; a lista de publicações é a
     * mesma nos dois idiomas, daí o Map por slug.
     */
    sitemap: sitemapXml(
      SITE,
      [...listed].map(([slug, publishedAt]) => ({ slug, publishedAt })),
    ),
    robots: robotsTxt(SITE),
  };
}

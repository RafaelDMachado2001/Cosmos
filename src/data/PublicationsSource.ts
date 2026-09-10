/**
 * A fonte de publicações.
 *
 * Hoje só existe o adapter estático, que lê as fixtures locais. Quando o
 * backend em Laravel entrar, um adapter HTTP implementa esta mesma interface e
 * a constelação não muda — é por isso que a assinatura já espelha os
 * parâmetros da API planejada (`locale`, `category`, `q`, `before`, `limit`).
 */

import { matches } from '../core/filter';
import type { Category, Locale, Publication, PublicationSummary } from '../core/types';

export interface ListQuery {
  readonly locale: Locale;
  readonly category?: Category | 'all';
  readonly q?: string;
  /** Janela temporal: só publicações estritamente anteriores a este instante. */
  readonly before?: string;
  readonly limit?: number;
}

/** A publicação completa, já resolvida num idioma. */
export interface PublicationDetail extends PublicationSummary {
  readonly body: readonly string[];
}

export interface PublicationsSource {
  /** Lista enxuta, do mais novo para o mais antigo, para montar a constelação. */
  list(query: ListQuery): Promise<readonly PublicationSummary[]>;
  get(slug: string, locale: Locale): Promise<PublicationDetail | null>;
}

function toSummary(publication: Publication, locale: Locale): PublicationSummary {
  const content = publication.content[locale];
  return {
    slug: publication.slug,
    publishedAt: publication.publishedAt,
    category: publication.category,
    ...(publication.featured === undefined ? {} : { featured: publication.featured }),
    title: content.title,
    summary: content.summary,
  };
}

export function createStaticSource(publications: readonly Publication[]): PublicationsSource {
  // Ordena uma vez: a ordem decrescente é a mesma do índice
  // publications(published_at desc) que o backend vai usar.
  const newestFirst = [...publications].sort(
    (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
  );
  const bySlug = new Map(publications.map((publication) => [publication.slug, publication]));

  return {
    list(query) {
      const category = query.category ?? 'all';
      const q = query.q ?? '';
      const before = query.before === undefined ? null : Date.parse(query.before);

      const found = newestFirst.filter((publication) => {
        if (before !== null && Date.parse(publication.publishedAt) >= before) return false;

        const content = publication.content[query.locale];
        return matches(
          {
            slug: publication.slug,
            category: publication.category,
            title: content.title,
            summary: content.summary,
            // O adapter estático não conhece rótulos traduzidos nem formatação
            // de data — quem os tem é a camada de apresentação. A busca por
            // categoria e por data acontece lá, sobre a projeção já traduzida.
            categoryLabel: '',
            dateLabel: publication.publishedAt,
          },
          { category, query: q },
        );
      });

      const limited = query.limit === undefined ? found : found.slice(0, query.limit);
      return Promise.resolve(limited.map((publication) => toSummary(publication, query.locale)));
    },

    get(slug, locale) {
      const publication = bySlug.get(slug);
      if (!publication) return Promise.resolve(null);
      return Promise.resolve({
        ...toSummary(publication, locale),
        body: publication.content[locale].body,
      });
    },
  };
}

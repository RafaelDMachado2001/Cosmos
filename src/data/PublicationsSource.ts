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

// ---------------------------------------------------------------------------
// Adapter HTTP
// ---------------------------------------------------------------------------

/**
 * A publicação como o Laravel a devolve.
 *
 * `published_at` em snake_case e o corpo já em parágrafos: dividir o texto é
 * trabalho do servidor, que é quem sabe em que formato o guardou. A
 * constelação sempre falou em parágrafos, e não vai passar a falar em markdown
 * por causa de onde o dado passou a morar.
 */
interface ApiPublication {
  readonly slug: string;
  readonly category: Category;
  readonly published_at: string;
  readonly featured: boolean;
  readonly title: string;
  readonly summary: string;
}

interface ApiPublicationDetail extends ApiPublication {
  readonly body: readonly string[];
}

function fromApi(row: ApiPublication): PublicationSummary {
  return {
    slug: row.slug,
    publishedAt: row.published_at,
    category: row.category,
    featured: row.featured,
    title: row.title,
    summary: row.summary,
  };
}

/**
 * O adapter que fala com a API do Laravel.
 *
 * Mesma interface do estático — é o que a fase 1 prometeu ao espelhar aqui os
 * parâmetros da API planejada. A constelação não sabe qual dos dois está
 * montado, e a suíte de contrato roda contra os dois.
 */
export function createHttpSource(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): PublicationsSource {
  const root = `${baseUrl.replace(/\/+$/, '')}/api/publications`;

  /**
   * Um erro de rede precisa chegar como erro.
   *
   * Devolver lista vazia aqui daria a tela de "nenhuma estrela encontrada" a
   * quem na verdade perdeu a conexão — e a única saída oferecida seria ajustar
   * uma busca que a pessoa não fez. Ver `src/core/collection.ts`.
   */
  async function json<T>(url: string): Promise<T> {
    const response = await fetchImpl(url);
    if (!response.ok) throw new Error(`${url} respondeu ${String(response.status)}`);
    return (await response.json()) as T;
  }

  return {
    async list(query) {
      const params = new URLSearchParams({ locale: query.locale });
      if (query.category !== undefined && query.category !== 'all') {
        params.set('category', query.category);
      }
      // Espaço em branco não é busca: mandá-lo faria o `websearch_to_tsquery`
      // devolver vazio, e a constelação inteira apagaria por um campo em branco.
      if (query.q !== undefined && query.q.trim() !== '') params.set('q', query.q);
      if (query.before !== undefined) params.set('before', query.before);
      if (query.limit !== undefined) params.set('limit', String(query.limit));

      const payload = await json<{ data: readonly ApiPublication[] }>(`${root}?${params.toString()}`);
      return payload.data.map(fromApi);
    },

    async get(slug, locale) {
      const url = `${root}/${encodeURIComponent(slug)}?locale=${locale}`;
      const response = await fetchImpl(url);
      // 404 é ausência — o slug não existe — e quem chama decide o que fazer.
      // Qualquer outro status é falha, e não pode virar "publicação sem texto".
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`${url} respondeu ${String(response.status)}`);

      const payload = (await response.json()) as { data: ApiPublicationDetail };
      return { ...fromApi(payload.data), body: payload.data.body };
    },
  };
}

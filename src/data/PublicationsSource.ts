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
import { LOCALES, isLocale } from '../core/types';

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
  /** Markdown cru — ver `PublicationContent.body` em `core/types.ts`. */
  readonly body: string;
  /**
   * Override de `<title>`/`og:title` e da meta description, com fallback
   * para `title`/`summary` quando ausente. Só a API conhece — o acervo
   * semente nunca define nenhum dos dois.
   */
  readonly seoTitle?: string;
  readonly seoDescription?: string;
  /**
   * Os idiomas em que este artigo existe — o hreflang e o
   * `og:locale:alternate` só podem apontar para estes.
   */
  readonly locales: readonly Locale[];
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
    ...(publication.updatedAt === undefined ? {} : { updatedAt: publication.updatedAt }),
    ...(publication.indexable === undefined ? {} : { indexable: publication.indexable }),
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
        locales: LOCALES,
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
 * `published_at` em snake_case. O corpo vem como a string de Markdown crua —
 * dividir em blocos é trabalho de `core/blocks.ts`, uma vez, não do servidor.
 */
interface ApiPublication {
  readonly slug: string;
  readonly category: Category;
  readonly published_at: string;
  readonly updated_at: string;
  readonly featured: boolean;
  readonly indexable: boolean;
  readonly title: string;
  readonly summary: string;
}

interface ApiPublicationDetail extends ApiPublication {
  readonly body: string;
  readonly seo_title: string | null;
  readonly seo_description: string | null;
  readonly locales: readonly string[];
}

function fromApi(row: ApiPublication): PublicationSummary {
  return {
    slug: row.slug,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
    category: row.category,
    featured: row.featured,
    indexable: row.indexable,
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
interface ApiMeta {
  readonly count: number;
  readonly limit: number;
  readonly truncated: boolean;
}

export interface HttpSourceOptions {
  /**
   * Chamado quando a API declara que cortou o acervo.
   *
   * Sem isto, truncamento lanca — que e o comportamento que o prerender quer:
   * um site publicado com metade do acervo e pior que um build vermelho. No
   * cliente, truncamento e falha de operacao, nao estado de leitura, entao la
   * quem chama passa um aviso de console e a constelacao segue.
   */
  readonly onTruncated?: (meta: { count: number; limit: number }) => void;
  /**
   * Identifica o prerender para a API, que o isenta do throttle público.
   *
   * Uma regeração completa já soma dezenas de chamadas (duas listas mais uma
   * por publicação por idioma) e cresce com o acervo — mais rápido do que
   * qualquer limite pensado para um cliente público aguentaria. Nunca vem do
   * navegador: só `src/prerender/main.ts`, que roda em Node, lê o processo e
   * passa aqui.
   */
  readonly internalToken?: string | null;
}

export function createHttpSource(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
  options: HttpSourceOptions = {},
): PublicationsSource {
  const root = `${baseUrl.replace(/\/+$/, '')}/api/publications`;
  const headers: Record<string, string> =
    options.internalToken === undefined || options.internalToken === null
      ? {}
      : { 'X-Internal-Token': options.internalToken };

  /**
   * Um erro de rede precisa chegar como erro.
   *
   * Devolver lista vazia aqui daria a tela de "nenhuma estrela encontrada" a
   * quem na verdade perdeu a conexão — e a única saída oferecida seria ajustar
   * uma busca que a pessoa não fez. Ver `src/core/collection.ts`.
   */
  async function json<T>(url: string): Promise<T> {
    const response = await fetchImpl(url, { headers });
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

      const payload = await json<{ data: readonly ApiPublication[]; meta?: ApiMeta }>(
        `${root}?${params.toString()}`,
      );

      if (payload.meta?.truncated === true) {
        const meta = { count: payload.meta.count, limit: payload.meta.limit };
        if (options.onTruncated === undefined) {
          throw new Error(
            `Acervo truncado pela API em ${String(meta.limit)} publicacoes, e havia mais. ` +
              'Publicar o site assim esconderia publicacoes.',
          );
        }
        options.onTruncated(meta);
      }

      return payload.data.map(fromApi);
    },

    async get(slug, locale) {
      const url = `${root}/${encodeURIComponent(slug)}?locale=${locale}`;
      const response = await fetchImpl(url, { headers });
      // 404 é ausência — o slug não existe — e quem chama decide o que fazer.
      // Qualquer outro status é falha, e não pode virar "publicação sem texto".
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`${url} respondeu ${String(response.status)}`);

      const payload = (await response.json()) as { data: ApiPublicationDetail };
      return {
        ...fromApi(payload.data),
        body: payload.data.body,
        locales: payload.data.locales.filter(isLocale),
        ...(payload.data.seo_title === null ? {} : { seoTitle: payload.data.seo_title }),
        ...(payload.data.seo_description === null
          ? {}
          : { seoDescription: payload.data.seo_description }),
      };
    },
  };
}

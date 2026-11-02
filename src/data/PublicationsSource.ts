import { parseAppearance } from '../core/appearance';
import type { Appearance } from '../core/appearance';
import { matches } from '../core/filter';
import type { Category, Locale, Publication, PublicationSummary } from '../core/types';
import { LOCALES, isLocale } from '../core/types';

import { DEFAULT_RETRY, fetchWithRetry } from './fetchWithRetry';
import type { RetryPolicy } from './fetchWithRetry';

export interface ListQuery {
  readonly locale: Locale;
  readonly category?: Category | 'all';
  readonly q?: string;
  readonly before?: string;
  readonly limit?: number;
}

export interface PublicationDetail extends PublicationSummary {
  readonly body: string;
  readonly seoTitle?: string;
  readonly seoDescription?: string;
  readonly locales: readonly Locale[];
  readonly appearance?: Appearance | null;
  readonly tags: readonly string[];
}

export interface PublicationsSource {
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
        tags: [],
      });
    },
  };
}

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
  readonly locales?: readonly string[];
  readonly appearance?: unknown;
  readonly tags?: readonly unknown[];
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

interface ApiMeta {
  readonly count: number;
  readonly limit: number;
  readonly truncated: boolean;
}

export interface HttpSourceOptions {
  readonly onTruncated?: (meta: { count: number; limit: number }) => void;
  readonly internalToken?: string | null;
  readonly retry?: RetryPolicy;
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
  const retry = options.retry ?? DEFAULT_RETRY;

  async function json<T>(url: string): Promise<T> {
    const response = await fetchWithRetry(fetchImpl, url, { headers }, retry);
    if (!response.ok) throw new Error(`${url} respondeu ${String(response.status)}`);
    return (await response.json()) as T;
  }

  return {
    async list(query) {
      const params = new URLSearchParams({ locale: query.locale });
      if (query.category !== undefined && query.category !== 'all') {
        params.set('category', query.category);
      }
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
      const response = await fetchWithRetry(fetchImpl, url, { headers }, retry);
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`${url} respondeu ${String(response.status)}`);

      const payload = (await response.json()) as { data: ApiPublicationDetail };
      return {
        ...fromApi(payload.data),
        body: payload.data.body,
        locales: payload.data.locales?.filter(isLocale) ?? LOCALES,
        appearance: parseAppearance(payload.data.appearance),
        tags: (payload.data.tags ?? []).filter((tag): tag is string => typeof tag === 'string'),
        ...(payload.data.seo_title === null ? {} : { seoTitle: payload.data.seo_title }),
        ...(payload.data.seo_description === null
          ? {}
          : { seoDescription: payload.data.seo_description }),
      };
    },
  };
}

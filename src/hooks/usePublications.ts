import { useCallback, useEffect, useMemo, useState } from 'react';

import { failed, loaded, loading, retry as retryCollection } from '../core/collection';
import type { CollectionState } from '../core/collection';
import type { Locale, PublicationSummary } from '../core/types';
import type { DetailCache } from '../data/detailCache';
import type { PublicationDetail, PublicationsSource } from '../data/PublicationsSource';
import type { SnapshotLoader } from '../data/snapshotLoader';

export interface Collection {
  readonly state: CollectionState<PublicationSummary>;
  retry: () => void;
}

export function usePublications(
  source: PublicationsSource,
  locale: Locale,
  snapshot: SnapshotLoader | null = null,
): Collection {
  const [state, setState] = useState(() => loading<PublicationSummary>());
  const { attempt } = state;

  useEffect(() => {
    let cancelled = false;
    let fromApi = false;

    const fallback = snapshot === null ? Promise.resolve(null) : snapshot(locale);
    void fallback.then((items) => {
      if (!cancelled && !fromApi && items !== null) setState((current) => loaded(current, items));
    });

    source
      .list({ locale })
      .then((items) => {
        fromApi = true;
        if (!cancelled) setState((current) => loaded(current, items));
      })
      .catch(async () => {
        const items = await fallback;
        if (!cancelled && items === null) setState(failed);
      });

    return () => {
      cancelled = true;
    };
  }, [source, locale, snapshot, attempt]);

  const retry = useCallback(() => {
    setState(retryCollection);
  }, []);

  return { state, retry };
}

export type ArticleState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly detail: PublicationDetail }
  | { readonly status: 'missing' };

const IDLE: ArticleState = { status: 'idle' };

const LOADING: ArticleState = { status: 'loading' };

export function useArticle(
  cache: DetailCache,
  slug: string | null,
  locale: Locale,
): ArticleState {
  const [state, setState] = useState<{ key: string | null; article: ArticleState }>({
    key: null,
    article: IDLE,
  });

  useEffect(() => {
    if (slug === null) return;

    let cancelled = false;
    const key = `${locale}/${slug}`;

    cache
      .get(slug, locale)
      .then((detail) => {
        if (cancelled) return;
        setState({
          key,
          article: detail === null ? { status: 'missing' } : { status: 'ready', detail },
        });
      })
      .catch(() => {
        if (!cancelled) setState({ key, article: { status: 'missing' } });
      });

    return () => {
      cancelled = true;
    };
  }, [cache, slug, locale]);

  const cached = slug === null ? undefined : cache.peek(slug, locale);
  const fromCache = useMemo<ArticleState | null>(
    () => (cached ? { status: 'ready', detail: cached } : null),
    [cached],
  );

  if (slug === null) return IDLE;
  if (fromCache) return fromCache;
  return state.key === `${locale}/${slug}` ? state.article : LOADING;
}

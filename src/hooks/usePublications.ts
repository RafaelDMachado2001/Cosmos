import { useCallback, useEffect, useState } from 'react';

import { failed, loaded, loading, retry as retryCollection } from '../core/collection';
import type { CollectionState } from '../core/collection';
import type { Locale, PublicationSummary } from '../core/types';
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

export function useArticle(
  source: PublicationsSource,
  slug: string | null,
  locale: Locale,
): ArticleState {
  const [state, setState] = useState<ArticleState>(IDLE);

  useEffect(() => {
    if (slug === null) {
      setState(IDLE);
      return;
    }

    let cancelled = false;
    setState({ status: 'loading' });

    source
      .get(slug, locale)
      .then((detail) => {
        if (cancelled) return;
        setState(detail === null ? { status: 'missing' } : { status: 'ready', detail });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'missing' });
      });

    return () => {
      cancelled = true;
    };
  }, [source, slug, locale]);

  return state;
}

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

/**
 * O acervo, vindo da fonte.
 *
 * Com a API, o snapshot do build e a API são pedidos juntos. O que chegar
 * primeiro abre a constelação; a resposta da API, quando vem, substitui o
 * snapshot. Se a API falha, o snapshot fica, sem erro na tela: a API acordando
 * de uma partida a frio não é problema de quem lê. Só sem os dois a tela é de
 * erro.
 */
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
      // Um snapshot que chega depois da API é mais velho que ela: descartado.
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
      // Trocar de idioma dispara um segundo carregamento antes de o primeiro
      // responder. Sem isto a resposta antiga poderia chegar por último e
      // sobrescrever a nova.
      cancelled = true;
    };
  }, [source, locale, snapshot, attempt]);

  const retry = useCallback(() => {
    setState(retryCollection);
  }, []);

  return { state, retry };
}

/**
 * O corpo do artigo.
 *
 * `null` enquanto não há nada aberto ou o texto não chegou; `missing` quando a
 * fonte não o tem. A busca começa junto com o avanço da câmera, e os 760ms que
 * ela leva são folga de sobra para a resposta.
 */
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

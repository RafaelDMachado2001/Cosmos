import { useCallback, useEffect, useState } from 'react';

import { failed, loaded, loading, retry as retryCollection } from '../core/collection';
import type { CollectionState } from '../core/collection';
import type { Locale, PublicationSummary } from '../core/types';
import type { PublicationDetail, PublicationsSource } from '../data/PublicationsSource';

export interface Collection {
  readonly state: CollectionState<PublicationSummary>;
  retry: () => void;
}

/**
 * O acervo, vindo da fonte.
 *
 * Hoje a fonte é o adapter estático e nunca falha; a fase 7 troca por um
 * adapter HTTP sem que nada aqui mude. É por isso que os estados de espera e
 * de erro existem desde já: encená-los depois, sobre um `import` síncrono,
 * daria uma tela que não corresponde a nenhum caminho real do código.
 */
export function usePublications(source: PublicationsSource, locale: Locale): Collection {
  const [state, setState] = useState(() => loading<PublicationSummary>());
  const { attempt } = state;

  useEffect(() => {
    let cancelled = false;

    source
      .list({ locale })
      .then((items) => {
        if (!cancelled) setState((current) => loaded(current, items));
      })
      .catch(() => {
        if (!cancelled) setState(failed);
      });

    return () => {
      // Trocar de idioma dispara um segundo carregamento antes de o primeiro
      // responder. Sem isto a resposta antiga poderia chegar por último e
      // sobrescrever a nova.
      cancelled = true;
    };
  }, [source, locale, attempt]);

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

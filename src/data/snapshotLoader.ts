import { parseSnapshot, snapshotPath } from '../core/snapshot';
import type { Locale, PublicationSummary } from '../core/types';

import { DEFAULT_RETRY, fetchWithRetry } from './fetchWithRetry';

/** O acervo do build, ou `null` quando não há — nunca lança. */
export type SnapshotLoader = (locale: Locale) => Promise<readonly PublicationSummary[] | null>;

/**
 * Lê o `data/publications.<locale>.json` que o prerender grava.
 *
 * Arquivo estático no mesmo host do HTML: uma tentativa só, com o mesmo prazo
 * da API. Faltar o arquivo — no Vite de desenvolvimento, por exemplo — é o
 * caso normal de "não há snapshot", não um erro: a constelação espera a API.
 */
export function createSnapshotLoader(fetchImpl: typeof fetch = fetch): SnapshotLoader {
  return async (locale) => {
    try {
      const response = await fetchWithRetry(
        fetchImpl,
        snapshotPath(locale),
        {},
        { ...DEFAULT_RETRY, delaysMs: [] },
      );
      if (!response.ok) return null;
      return parseSnapshot(await response.json());
    } catch {
      return null;
    }
  };
}

import { parseSnapshot, snapshotPath } from '../core/snapshot';
import type { Locale, PublicationSummary } from '../core/types';

import { DEFAULT_RETRY, fetchWithRetry } from './fetchWithRetry';

export type SnapshotLoader = (locale: Locale) => Promise<readonly PublicationSummary[] | null>;

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

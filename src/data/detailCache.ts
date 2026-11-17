import type { Locale } from '../core/types';
import type { PublicationDetail, PublicationsSource } from './PublicationsSource';

export interface DetailCache {
  get(slug: string, locale: Locale): Promise<PublicationDetail | null>;
  peek(slug: string, locale: Locale): PublicationDetail | undefined;
  prefetch(slug: string, locale: Locale): void;
}

export function createDetailCache(source: PublicationsSource): DetailCache {
  const ready = new Map<string, PublicationDetail>();
  const pending = new Map<string, Promise<PublicationDetail | null>>();
  const keyOf = (slug: string, locale: Locale): string => `${locale}/${slug}`;

  function get(slug: string, locale: Locale): Promise<PublicationDetail | null> {
    const key = keyOf(slug, locale);
    const hit = ready.get(key);
    if (hit) return Promise.resolve(hit);
    const inFlight = pending.get(key);
    if (inFlight) return inFlight;

    const request = source.get(slug, locale).then(
      (detail) => {
        pending.delete(key);
        if (detail !== null) ready.set(key, detail);
        return detail;
      },
      (error: unknown) => {
        pending.delete(key);
        throw error;
      },
    );
    pending.set(key, request);
    return request;
  }

  return {
    get,
    peek: (slug, locale) => ready.get(keyOf(slug, locale)),
    prefetch(slug, locale) {
      get(slug, locale).catch(() => undefined);
    },
  };
}

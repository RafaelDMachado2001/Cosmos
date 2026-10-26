import { useCallback, useMemo } from 'react';

import { monthYearLabel, shortTitle } from '../core/format';
import type { PlacedStar } from '../core/timeline';
import type { Locale, PublicationSummary } from '../core/types';
import type { Dictionary } from '../i18n/pt';

export interface StarCaption {
  readonly title: string;
  readonly date: string;
}

export interface StarLookup {
  readonly summaryBySlug: ReadonlyMap<string, PublicationSummary>;
  readonly starBySlug: ReadonlyMap<string, PlacedStar>;
  /** "mês ano" no idioma da página. */
  readonly dateLabel: (timestamp: number) => string;
  /** O nome acessível de cada estrela: título, categoria e data. */
  readonly labelFor: (star: PlacedStar) => string;
  /** O rótulo visível que pende da estrela. */
  readonly captionFor: (star: PlacedStar) => StarCaption;
}

/**
 * Os índices por slug e os textos de cada estrela, montados uma vez por acervo
 * e idioma.
 *
 * `labelFor` roda uma vez por estrela a cada render: com busca linear, 500
 * publicações eram 250 mil comparações por passada. As legendas são memoizadas
 * pelo mesmo motivo — a `Star` é memo, e um objeto novo a cada render a faria
 * re-renderizar com qualquer hover.
 */
export function useStarLookup(
  summaries: readonly PublicationSummary[],
  stars: readonly PlacedStar[],
  locale: Locale,
  t: Dictionary,
): StarLookup {
  const summaryBySlug = useMemo(
    () => new Map(summaries.map((summary) => [summary.slug, summary])),
    [summaries],
  );
  const starBySlug = useMemo(() => new Map(stars.map((star) => [star.slug, star])), [stars]);

  const dateLabel = useCallback((timestamp: number) => monthYearLabel(timestamp, locale), [locale]);

  const labelFor = useCallback(
    (star: PlacedStar) => {
      const title = summaryBySlug.get(star.slug)?.title ?? star.slug;
      return `${title} — ${t.categories[star.category]} — ${dateLabel(star.timestamp)}`;
    },
    [summaryBySlug, t, dateLabel],
  );

  const captions = useMemo(
    () =>
      new Map(
        stars.map((star) => [
          star.slug,
          {
            title: shortTitle(summaryBySlug.get(star.slug)?.title ?? star.slug),
            date: dateLabel(star.timestamp),
          },
        ]),
      ),
    [stars, summaryBySlug, dateLabel],
  );
  const captionFor = useCallback(
    (star: PlacedStar) => captions.get(star.slug) ?? { title: star.slug, date: '' },
    [captions],
  );

  return { summaryBySlug, starBySlug, dateLabel, labelFor, captionFor };
}

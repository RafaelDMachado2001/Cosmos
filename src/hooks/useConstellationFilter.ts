import { useEffect, useMemo, useRef, useState } from 'react';

import { countByCategory, dimmedStars } from '../core/filter';
import type { SearchableStar } from '../core/filter';
import type { PlacedStar } from '../core/timeline';
import type { Category, PublicationSummary } from '../core/types';
import type { Dictionary } from '../i18n/pt';

export interface ConstellationFilter {
  readonly query: string;
  readonly setQuery: (query: string) => void;
  readonly category: Category | 'all';
  readonly setCategory: (category: Category | 'all') => void;
  /** As estrelas que o critério atual apaga. */
  readonly dimmed: ReadonlySet<string>;
  readonly counts: ReturnType<typeof countByCategory>;
}

/**
 * Busca e filtro por categoria sobre a constelação.
 *
 * O rótulo da categoria e a data formatada entram na projeção buscável porque o
 * handoff manda buscar por eles, e só esta camada os conhece traduzidos — o
 * adapter guarda o slug da categoria e um ISO, que ninguém digita.
 */
export function useConstellationFilter(
  summaries: readonly PublicationSummary[],
  stars: readonly PlacedStar[],
  t: Dictionary,
  dateLabel: (timestamp: number) => string,
  slideTo: (star: PlacedStar) => void,
): ConstellationFilter {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category | 'all'>('all');

  const searchable = useMemo<readonly SearchableStar[]>(
    () =>
      summaries.map((item) => ({
        slug: item.slug,
        category: item.category,
        title: item.title,
        summary: item.summary,
        categoryLabel: t.categories[item.category],
        dateLabel: dateLabel(Date.parse(item.publishedAt)),
      })),
    [summaries, t, dateLabel],
  );

  const dimmed = useMemo(
    () => dimmedStars(searchable, { category, query }),
    [searchable, category, query],
  );
  const counts = useMemo(() => countByCategory(searchable), [searchable]);

  /**
   * A câmera desliza até o primeiro resultado — mas só quando o critério muda.
   *
   * Reagir a `dimmed` sem esta guarda arrastaria a câmera também na chegada dos
   * dados e na troca de idioma, arrancando o leitor de onde ele estava por uma
   * mudança que não foi dele.
   */
  const criteriaKey = `${category}\u0000${query}`;
  const lastCriteriaRef = useRef(criteriaKey);

  useEffect(() => {
    if (lastCriteriaRef.current === criteriaKey) return;
    lastCriteriaRef.current = criteriaKey;
    const first = stars.find((star) => !dimmed.has(star.slug));
    if (first) slideTo(first);
  }, [criteriaKey, stars, dimmed, slideTo]);

  return { query, setQuery, category, setCategory, dimmed, counts };
}

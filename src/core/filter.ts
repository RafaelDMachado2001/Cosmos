import { CATEGORIES } from './types';
import type { Category } from './types';

export interface SearchableStar {
  readonly slug: string;
  readonly category: Category;
  readonly title: string;
  readonly summary: string;
  readonly categoryLabel: string;
  readonly dateLabel: string;
}

export interface FilterCriteria {
  readonly category: Category | 'all';
  readonly query: string;
}

export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function haystack(star: SearchableStar): string {
  return normalize(`${star.title} ${star.summary} ${star.categoryLabel} ${star.dateLabel}`);
}

export function matches(star: SearchableStar, criteria: FilterCriteria): boolean {
  if (criteria.category !== 'all' && star.category !== criteria.category) return false;

  const query = normalize(criteria.query).trim();
  if (query === '') return true;

  return haystack(star).includes(query);
}

export function filterStars(
  stars: readonly SearchableStar[],
  criteria: FilterCriteria,
): readonly string[] {
  return stars.filter((star) => matches(star, criteria)).map((star) => star.slug);
}

export type CategoryCounts = Record<Category | 'all', number>;

export function countByCategory(stars: readonly SearchableStar[]): CategoryCounts {
  const counts = { all: stars.length } as CategoryCounts;
  for (const category of CATEGORIES) counts[category] = 0;
  for (const star of stars) counts[star.category] += 1;
  return counts;
}

export function categoryRows(
  counts: CategoryCounts,
  active: Category | 'all',
): readonly (Category | 'all')[] {
  return ['all', ...CATEGORIES.filter((category) => counts[category] > 0 || category === active)];
}

export function dimmedStars(
  stars: readonly SearchableStar[],
  criteria: FilterCriteria,
): ReadonlySet<string> {
  const dimmed = new Set<string>();
  for (const star of stars) {
    if (!matches(star, criteria)) dimmed.add(star.slug);
  }
  return dimmed;
}

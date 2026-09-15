/**
 * Busca e filtro por categoria.
 *
 * Espelha o que o `websearch_to_tsquery` fará no backend em termos de campos
 * cobertos — título, resumo, rótulo da categoria e data — mas roda no cliente,
 * porque a constelação inteira já está carregada e o apagamento das estrelas
 * precisa ser imediato.
 *
 * Módulo puro: sem DOM, sem React, sem Three.
 */

import { CATEGORIES } from './types';
import type { Category } from './types';

/** A projeção de uma publicação sobre a qual a busca opera, já no idioma ativo. */
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

/**
 * Caixa baixa e sem acentos.
 *
 * Normalizar dos dois lados é o que faz "indice" encontrar "índices": quem
 * busca em português raramente digita o acento, e o protótipo, que fazia
 * `includes` cru, simplesmente não achava.
 */
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

/** Slugs correspondentes, preservando a ordem recebida (cronológica). */
export function filterStars(
  stars: readonly SearchableStar[],
  criteria: FilterCriteria,
): readonly string[] {
  return stars.filter((star) => matches(star, criteria)).map((star) => star.slug);
}

export type CategoryCounts = Record<Category | 'all', number>;

/** Contagens para o painel de categorias. Categoria sem itens aparece zerada,
 *  não some: sumir mudaria o layout do painel a cada publicação. */
export function countByCategory(stars: readonly SearchableStar[]): CategoryCounts {
  const counts = { all: stars.length } as CategoryCounts;
  for (const category of CATEGORIES) counts[category] = 0;
  for (const star of stars) counts[star.category] += 1;
  return counts;
}

/**
 * Os slugs que **não** correspondem — os que apagam.
 *
 * O complemento, e não a lista de resultados, porque é isso que a constelação
 * consome: estrela fora da busca vai a 7% de opacidade e perde o ponteiro,
 * nunca some. Ela continua no DOM, no Tab e no Ctrl+F.
 */
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

/**
 * O sumário de um artigo e as âncoras dos intertítulos.
 *
 * `ArticleBody` põe o `id` em cada intertítulo e a tela de leitura monta o
 * "Neste artigo" a partir da mesma função: os dois nunca divergem, e nada
 * precisa ser gravado no banco — o id é derivado do texto, como a posição
 * de uma estrela é derivada da data.
 *
 * Módulo puro: sem DOM, sem React, sem Three.
 */

import type { Block, InlineNode } from './blocks';
import { slugify } from './slug';

export interface OutlineEntry {
  readonly id: string;
  readonly label: string;
  readonly level: 2 | 3;
}

/** O texto que um leitor vê, sem marcação. */
export function inlineText(nodes: readonly InlineNode[]): string {
  return nodes
    .map((node) => (node.type === 'text' || node.type === 'code' ? node.text : inlineText(node.children)))
    .join('');
}

/**
 * Um id por intertítulo, na ordem do texto. Repetidos ganham `-2`, `-3`;
 * um título sem nenhuma letra ou número vira `secao`.
 */
export function outline(blocks: readonly Block[]): readonly OutlineEntry[] {
  const used = new Map<string, number>();
  const entries: OutlineEntry[] = [];

  for (const block of blocks) {
    if (block.type !== 'heading') continue;
    const label = inlineText(block.children).trim();
    const base = slugify(label) || 'secao';
    const count = (used.get(base) ?? 0) + 1;
    used.set(base, count);
    entries.push({ id: count === 1 ? base : `${base}-${String(count)}`, label, level: block.level });
  }

  return entries;
}

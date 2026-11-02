import type { Block, InlineNode } from './blocks';
import { slugify } from './slug';

export interface OutlineEntry {
  readonly id: string;
  readonly label: string;
  readonly level: 2 | 3;
}

export function inlineText(nodes: readonly InlineNode[]): string {
  return nodes
    .map((node) => (node.type === 'text' || node.type === 'code' ? node.text : inlineText(node.children)))
    .join('');
}

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

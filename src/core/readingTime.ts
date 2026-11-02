import type { Block } from './blocks';
import { inlineText } from './outline';

export const WORDS_PER_MINUTE = 220;
const WORDS_PER_CODE_LINE = 2;

function words(text: string): number {
  const trimmed = text.trim();
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length;
}

function blockWords(block: Block): number {
  switch (block.type) {
    case 'heading':
    case 'paragraph':
    case 'quote':
    case 'highlight':
      return words(inlineText(block.children));
    case 'note':
      return words(inlineText(block.title ?? [])) + words(inlineText(block.children));
    case 'list':
      return block.items.reduce((sum, item) => sum + words(inlineText(item)), 0);
    case 'flow':
      return block.steps.reduce((sum, step) => sum + words(inlineText(step)), 0);
    case 'table':
      return [block.header, ...block.rows].flat().reduce((sum, cell) => sum + words(inlineText(cell)), 0);
    case 'code':
      return block.code.split('\n').filter((line) => line.trim() !== '').length * WORDS_PER_CODE_LINE;
    case 'image':
      return 0;
  }
}

export function wordCount(blocks: readonly Block[]): number {
  return blocks.reduce((sum, block) => sum + blockWords(block), 0);
}

export function readingMinutes(blocks: readonly Block[]): number {
  return Math.max(1, Math.ceil(wordCount(blocks) / WORDS_PER_MINUTE));
}

/**
 * Validação de bloco e contagem de palavras para o editor do RDM Studio.
 *
 * O servidor valida de novo em PHP (`ValidDraftBlocks`) — é ele que decide
 * de verdade. Isto é só o aviso imediato na tela, antes do round-trip.
 *
 * Módulo puro: sem DOM, sem React, sem Three.
 */

import { safeUrl } from './blocks';
import type { DraftBlock } from './draftBlocks';

function words(text: string): number {
  const trimmed = text.trim();
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length;
}

/** Soma o texto de prosa de todos os blocos. Código não conta — não é texto lido. */
export function wordCount(blocks: readonly DraftBlock[]): number {
  return blocks.reduce((total, block) => {
    switch (block.type) {
      case 'p':
      case 'h2':
      case 'h3':
      case 'quote':
        return total + words(block.text);
      case 'list':
        return total + block.items.reduce((sum, item) => sum + words(item), 0);
      case 'img':
        return total + words(block.alt);
      case 'table':
        return total + [block.header, ...block.rows].flat().reduce((sum, cell) => sum + words(cell), 0);
      case 'code':
        return total;
    }
  }, 0);
}

/** `null` quando o bloco está válido; senão, a mensagem para mostrar ao lado dele. */
export function validateDraftBlock(block: DraftBlock): string | null {
  switch (block.type) {
    case 'p':
    case 'h2':
    case 'h3':
    case 'quote':
      return block.text.trim() === '' ? 'Texto vazio.' : null;
    case 'code':
      if (block.text.trim() === '') return 'Código vazio.';
      // A linguagem vai na cerca de abertura; com espaço ou crase, a cerca
      // deixa de ser cerca e o bloco inteiro seria lido como parágrafo.
      if (block.lang !== null && /[\s`]/.test(block.lang.trim())) return 'Linguagem sem espaços nem crases.';
      return null;
    case 'list':
      if (block.items.length === 0) return 'Lista sem itens.';
      return block.items.some((item) => item.trim() === '') ? 'Item de lista vazio.' : null;
    case 'table':
      if (block.align.length === 0) return 'Tabela sem colunas.';
      if (block.header.length !== block.align.length || block.rows.some((row) => row.length !== block.align.length)) {
        return 'Toda linha precisa de uma célula por coluna.';
      }
      return block.header.every((cell) => cell.trim() === '') ? 'Tabela sem cabeçalho.' : null;
    case 'img':
      if (block.alt.trim() === '') return 'Imagem sem texto alternativo.';
      if (safeUrl(block.url) === null) return 'URL da imagem precisa ser http(s), raiz-relativo ou âncora.';
      return null;
  }
}

/** Todos os erros do rascunho, um por bloco inválido — vazio quando tudo passa. */
export function validateDraftBlocks(
  blocks: readonly DraftBlock[],
): readonly { readonly id: string; readonly message: string }[] {
  const errors: { readonly id: string; readonly message: string }[] = [];
  for (const block of blocks) {
    const message = validateDraftBlock(block);
    if (message !== null) errors.push({ id: block.id, message });
  }
  return errors;
}

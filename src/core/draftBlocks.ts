/**
 * A ponte entre o corpo publicado (Markdown cru) e o editor em blocos do
 * RDM Studio.
 *
 * `DraftBlock.text` guarda Markdown inline cru (`**negrito**`, `` `código` ``,
 * `[link](url)`) — o mesmo texto que o autor vê e edita, nunca uma árvore
 * parseada. Isso faz `draftBlocksToMarkdown` (o caminho de publicar) trivial:
 * cada tipo só precisa da própria sintaxe de bloco por cima de um texto que
 * já é Markdown. A ida (`blocksToDraftBlocks`, só para migrar o acervo
 * existente para rascunhos) reusa `parseBlocks`/`inlineToMarkdown` em vez de
 * duplicar a gramática de blocos.
 *
 * Um tipo a mais que o handoff do RDM Studio não lista: `list`. O acervo já
 * publicado tem listas (`core/blocks.ts` as interpreta desde a fase 11), e a
 * migração de dados desta fase não pode perder conteúdo que já existe.
 *
 * Módulo puro: sem DOM, sem React, sem Three.
 */

import { inlineToMarkdown, parseBlocks } from './blocks';

export type DraftBlock =
  | { readonly id: string; readonly type: 'p'; readonly text: string }
  | { readonly id: string; readonly type: 'h2' | 'h3'; readonly text: string }
  | { readonly id: string; readonly type: 'quote'; readonly text: string }
  | {
      readonly id: string;
      readonly type: 'list';
      readonly ordered: boolean;
      readonly items: readonly string[];
    }
  | { readonly id: string; readonly type: 'code'; readonly lang: string | null; readonly text: string }
  | {
      readonly id: string;
      readonly type: 'img';
      readonly url: string;
      /** Só quando a imagem veio do upload do painel, não de uma URL digitada. */
      readonly mediaId: number | null;
      readonly alt: string;
      readonly caption: string | null;
    };

/**
 * Um `id` estável por posição, só para a migração de dados. O editor (fase
 * 5) gera os seus próprios ids ao criar um bloco; estes nunca são lidos de
 * volta como identidade de nada no banco.
 */
function blockId(index: number): string {
  return `b${index}`;
}

/** Markdown publicado -> blocos do editor. Só para migrar o acervo existente. */
export function blocksToDraftBlocks(markdown: string): readonly DraftBlock[] {
  return parseBlocks(markdown).map((block, index): DraftBlock => {
    const id = blockId(index);
    switch (block.type) {
      case 'heading':
        return { id, type: block.level === 2 ? 'h2' : 'h3', text: inlineToMarkdown(block.children) };
      case 'paragraph':
        return { id, type: 'p', text: inlineToMarkdown(block.children) };
      case 'quote':
        return { id, type: 'quote', text: inlineToMarkdown(block.children) };
      case 'list':
        return {
          id,
          type: 'list',
          ordered: block.ordered,
          items: block.items.map((item) => inlineToMarkdown(item)),
        };
      case 'code':
        return { id, type: 'code', lang: block.language, text: block.code };
      case 'image':
        return { id, type: 'img', url: block.src, mediaId: null, alt: block.alt, caption: block.caption };
    }
  });
}

/** Blocos do editor -> o mesmo Markdown que `core/blocks.ts` sabe ler de volta. */
export function draftBlocksToMarkdown(blocks: readonly DraftBlock[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case 'p':
        case 'quote':
          return block.type === 'quote'
            ? block.text
                .split('\n')
                .map((line) => `> ${line}`)
                .join('\n')
            : block.text;
        case 'h2':
          return `## ${block.text}`;
        case 'h3':
          return `### ${block.text}`;
        case 'list':
          return block.items
            .map((item, index) => (block.ordered ? `${index + 1}. ${item}` : `- ${item}`))
            .join('\n');
        case 'code':
          return `\`\`\`${block.lang ?? ''}\n${block.text}\n\`\`\``;
        case 'img':
          return block.caption === null
            ? `![${block.alt}](${block.url})`
            : `![${block.alt}](${block.url} "${block.caption}")`;
      }
    })
    .join('\n\n');
}

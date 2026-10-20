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
import type { TableAlign } from './blocks';

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
      readonly type: 'table';
      readonly align: readonly TableAlign[];
      /** Markdown inline cru por célula, como `text` nos outros blocos. */
      readonly header: readonly string[];
      readonly rows: readonly (readonly string[])[];
    }
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
      case 'table':
        return {
          id,
          type: 'table',
          align: block.align,
          header: block.header.map((cell) => inlineToMarkdown(cell)),
          rows: block.rows.map((row) => row.map((cell) => inlineToMarkdown(cell))),
        };
      case 'image':
        return { id, type: 'img', url: block.src, mediaId: null, alt: block.alt, caption: block.caption };
    }
  });
}

/**
 * Uma linha só. `parseBlocks` já reflui as linhas de um parágrafo com um
 * espaço; fazer isso aqui, antes, é o que impede uma linha em branco de
 * partir o bloco em dois, ou uma linha começada por `- ` de virar lista.
 */
function oneLine(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .join(' ');
}

/**
 * O começo de um parágrafo que `parseBlocks` leria como outro bloco ganha uma
 * barra invertida — o escape que `parseInline` desfaz na leitura.
 */
function escapeParagraphStart(line: string): string {
  if (/^\d+\./.test(line)) return line.replace(/^(\d+)\./, '$1\\.');
  if (/^(#{2,3}\s|>|```|[-*]\s)/.test(line)) return `\\${line}`;
  // Imagem só existe como bloco próprio: num parágrafo, a sintaxe fica literal.
  if (line.startsWith('![')) return `!\\${line.slice(1)}`;
  return line;
}

/** A barra vertical separa colunas: dentro da célula, só escapada. */
function tableCell(text: string): string {
  return oneLine(text).replace(/\|/g, '\\|');
}

const DELIMITER: Record<NonNullable<TableAlign> | 'none', string> = {
  none: '---',
  left: ':---',
  center: ':---:',
  right: '---:',
};

function tableRow(cells: readonly string[]): string {
  return `| ${cells.map(tableCell).join(' | ')} |`;
}

/** Uma cerca maior que qualquer sequência de crases que abra uma linha do código. */
function codeFence(code: string): string {
  const longest = code
    .split('\n')
    .reduce((max, line) => Math.max(max, /^\s*(`*)/.exec(line)?.[1]?.length ?? 0), 0);
  return '`'.repeat(Math.max(3, longest + 1));
}

/**
 * A URL não tem escape no subconjunto: o que fecharia o parêntese ou abriria
 * a legenda vira percent-encoding, o mesmo endereço para o navegador.
 */
const PERCENT: Readonly<Record<string, string>> = { '(': '%28', ')': '%29', '"': '%22' };

function imageUrl(url: string): string {
  return url.trim().replace(/[()"\s]/g, (char) => PERCENT[char] ?? encodeURIComponent(char));
}

function escapeImageText(text: string, special: string): string {
  return oneLine(text).replace(new RegExp(`[\\\\${special}]`, 'g'), '\\$&');
}

/**
 * Blocos do editor -> o mesmo Markdown que `core/blocks.ts` sabe ler de volta.
 *
 * O contrato é de fidelidade: cada bloco do rascunho volta de `parseBlocks`
 * como um bloco só, do mesmo tipo e com o mesmo conteúdo — é o que faz a
 * pré-visualização e a página publicada mostrarem o que o autor escreveu.
 */
export function draftBlocksToMarkdown(blocks: readonly DraftBlock[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case 'p':
          return escapeParagraphStart(oneLine(block.text));
        case 'quote':
          return block.text
            .split(/\r?\n/)
            .map((line) => `> ${line}`)
            .join('\n');
        case 'h2':
          return `## ${oneLine(block.text)}`;
        case 'h3':
          return `### ${oneLine(block.text)}`;
        case 'list':
          return block.items
            .map((item, index) => (block.ordered ? `${index + 1}. ${oneLine(item)}` : `- ${oneLine(item)}`))
            .join('\n');
        case 'code': {
          const fence = codeFence(block.text);
          return `${fence}${block.lang?.trim() ?? ''}\n${block.text}\n${fence}`;
        }
        case 'table': {
          // Sempre uma célula por coluna do alinhamento: o parser descarta a
          // mais e completa a menos, e o rascunho tem de sair igual de lá.
          const fit = (cells: readonly string[]): string[] => block.align.map((_, column) => cells[column] ?? '');
          return [
            tableRow(fit(block.header)),
            `| ${block.align.map((align) => DELIMITER[align ?? 'none']).join(' | ')} |`,
            ...block.rows.map((row) => tableRow(fit(row))),
          ].join('\n');
        }
        case 'img': {
          const alt = escapeImageText(block.alt, '\\]');
          const url = imageUrl(block.url);
          return block.caption === null
            ? `![${alt}](${url})`
            : `![${alt}](${url} "${escapeImageText(block.caption, '"')}")`;
        }
      }
    })
    .join('\n\n');
}

import { DIAGRAM_LANGUAGE, inlineToMarkdown, parseBlocks } from './blocks';
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
  | { readonly id: string; readonly type: 'highlight'; readonly text: string }
  | { readonly id: string; readonly type: 'note'; readonly title: string | null; readonly text: string }
  | { readonly id: string; readonly type: 'flow'; readonly steps: readonly string[] }
  | {
      readonly id: string;
      readonly type: 'code';
      readonly lang: string | null;
      readonly filename?: string | null;
      readonly text: string;
    }
  | { readonly id: string; readonly type: 'diagram'; readonly source: string }
  | {
      readonly id: string;
      readonly type: 'table';
      readonly align: readonly TableAlign[];
      readonly header: readonly string[];
      readonly rows: readonly (readonly string[])[];
    }
  | {
      readonly id: string;
      readonly type: 'img';
      readonly url: string;
      readonly mediaId: number | null;
      readonly alt: string;
      readonly caption: string | null;
    };

function blockId(index: number): string {
  return `b${index}`;
}

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
      case 'highlight':
        return { id, type: 'highlight', text: inlineToMarkdown(block.children) };
      case 'note':
        return {
          id,
          type: 'note',
          title: block.title === null ? null : inlineToMarkdown(block.title),
          text: inlineToMarkdown(block.children),
        };
      case 'flow':
        return { id, type: 'flow', steps: block.steps.map((step) => inlineToMarkdown(step)) };
      case 'code':
        return { id, type: 'code', lang: block.language, filename: block.filename, text: block.code };
      case 'diagram':
        return { id, type: 'diagram', source: block.source };
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

function oneLine(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .join(' ');
}

function escapeParagraphStart(line: string): string {
  if (/^\d+\./.test(line)) return line.replace(/^(\d+)\./, '$1\\.');
  if (/^(#{2,3}\s|>|```|[-*]\s)/.test(line)) return `\\${line}`;
  if (line.startsWith('![')) return `!\\${line.slice(1)}`;
  return line;
}

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

function codeFence(code: string): string {
  const longest = code
    .split('\n')
    .reduce((max, line) => Math.max(max, /^\s*(`*)/.exec(line)?.[1]?.length ?? 0), 0);
  return '`'.repeat(Math.max(3, longest + 1));
}

const PERCENT: Readonly<Record<string, string>> = { '(': '%28', ')': '%29', '"': '%22' };

function imageUrl(url: string): string {
  return url.trim().replace(/[()"\s]/g, (char) => PERCENT[char] ?? encodeURIComponent(char));
}

function escapeImageText(text: string, special: string): string {
  return oneLine(text).replace(new RegExp(`[\\\\${special}]`, 'g'), '\\$&');
}

export function draftBlocksToMarkdown(blocks: readonly DraftBlock[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case 'p':
          return escapeParagraphStart(oneLine(block.text));
        case 'quote':
          return block.text
            .split(/\r?\n/)
            .map((line, index) => `> ${index === 0 && line.trimStart().startsWith('[!') ? `\\${line.trimStart()}` : line}`)
            .join('\n');
        case 'highlight':
          return `> [!highlight]\n> ${oneLine(block.text)}`;
        case 'note': {
          const title = block.title === null ? '' : oneLine(block.title);
          return `> [!note]${title === '' ? '' : ` ${title}`}\n> ${oneLine(block.text)}`;
        }
        case 'flow':
          return ['> [!flow]', ...block.steps.map((step) => `> - ${oneLine(step)}`)].join('\n');
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
          const filename = oneLine(block.filename ?? '');
          const title = filename === '' ? '' : ` title="${filename.replace(/["\\]/g, '\\$&')}"`;
          return `${fence}${block.lang?.trim() ?? ''}${title}\n${block.text}\n${fence}`;
        }
        case 'diagram': {
          const fence = codeFence(block.source);
          return `${fence}${DIAGRAM_LANGUAGE}\n${block.source}\n${fence}`;
        }
        case 'table': {
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

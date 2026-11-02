export type InlineNode =
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'strong'; readonly children: readonly InlineNode[] }
  | { readonly type: 'em'; readonly children: readonly InlineNode[] }
  | { readonly type: 'code'; readonly text: string }
  | { readonly type: 'link'; readonly href: string; readonly children: readonly InlineNode[] };

export type TableAlign = 'left' | 'center' | 'right' | null;

export type Block =
  | { readonly type: 'heading'; readonly level: 2 | 3; readonly children: readonly InlineNode[] }
  | { readonly type: 'paragraph'; readonly children: readonly InlineNode[] }
  | { readonly type: 'quote'; readonly children: readonly InlineNode[] }
  | {
      readonly type: 'list';
      readonly ordered: boolean;
      readonly items: readonly (readonly InlineNode[])[];
    }
  | { readonly type: 'highlight'; readonly children: readonly InlineNode[] }
  | {
      readonly type: 'note';
      readonly title: readonly InlineNode[] | null;
      readonly children: readonly InlineNode[];
    }
  | { readonly type: 'flow'; readonly steps: readonly (readonly InlineNode[])[] }
  | {
      readonly type: 'code';
      readonly code: string;
      readonly language: string | null;
      readonly filename: string | null;
    }
  | {
      readonly type: 'table';
      readonly align: readonly TableAlign[];
      readonly header: readonly (readonly InlineNode[])[];
      readonly rows: readonly (readonly (readonly InlineNode[])[])[];
    }
  | {
      readonly type: 'image';
      readonly src: string;
      readonly alt: string;
      readonly caption: string | null;
    };

export function safeUrl(url: string): string | null {
  const trimmed = url.trim();
  if (trimmed === '') return null;
  if (/^\/(?![/\\])/.test(trimmed) || trimmed.startsWith('#')) return trimmed;
  if (/^(https?|mailto):/i.test(trimmed)) return trimmed;
  return null;
}

const IMAGE_RE = /^!\[((?:\\.|[^\]\\])*)\]\(([^)"]*)(?:\s+"((?:\\.|[^"\\])*)")?\)$/;

const ESCAPABLE_RE = /\\([!-/:-@[-`{-~])/g;

export function unescapeMarkdown(value: string): string {
  return value.replace(ESCAPABLE_RE, '$1');
}

const INLINE_TOKEN_RE =
  /\\(?<escaped>[!-/:-@[-`{-~])|`(?<code>[^`]+)`|!\[(?<imageAlt>[^\]]*)\]\([^)]*\)|\[(?<linkText>[^\]]*)\]\((?<linkHref>[^)"]*)(?:\s+"[^"]*")?\)|\*\*(?<strong>[^*]+)\*\*|\*(?<em1>[^*]+)\*|_(?<em2>[^_]+)_/g;

function parseInline(raw: string): readonly InlineNode[] {
  const nodes: InlineNode[] = [];
  let cursor = 0;

  const pushText = (value: string): void => {
    if (value === '') return;
    const last = nodes[nodes.length - 1];
    if (last?.type === 'text') {
      nodes[nodes.length - 1] = { type: 'text', text: last.text + value };
      return;
    }
    nodes.push({ type: 'text', text: value });
  };

  for (const match of raw.matchAll(INLINE_TOKEN_RE)) {
    pushText(raw.slice(cursor, match.index));
    cursor = match.index + match[0].length;

    const groups = match.groups ?? {};

    if (groups.escaped !== undefined) {
      pushText(groups.escaped);
    } else if (groups.code !== undefined) {
      nodes.push({ type: 'code', text: groups.code });
    } else if (groups.imageAlt !== undefined) {
      pushText(groups.imageAlt);
    } else if (groups.linkText !== undefined && groups.linkHref !== undefined) {
      const href = safeUrl(groups.linkHref);
      if (href === null) {
        pushText(groups.linkText);
      } else {
        nodes.push({ type: 'link', href, children: parseInline(groups.linkText) });
      }
    } else if (groups.strong !== undefined) {
      nodes.push({ type: 'strong', children: parseInline(groups.strong) });
    } else if (groups.em1 !== undefined) {
      nodes.push({ type: 'em', children: parseInline(groups.em1) });
    } else if (groups.em2 !== undefined) {
      nodes.push({ type: 'em', children: parseInline(groups.em2) });
    }
  }
  pushText(raw.slice(cursor));

  return nodes;
}

function escapeText(value: string): string {
  const [first, ...rest] = parseInline(value);
  const same = first === undefined || (rest.length === 0 && first.type === 'text' && first.text === value);
  return same ? value : value.replace(/[\\`*_[\]!]/g, '\\$&');
}

export function inlineToMarkdown(nodes: readonly InlineNode[]): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case 'text':
          return escapeText(node.text);
        case 'code':
          return `\`${node.text}\``;
        case 'strong':
          return `**${inlineToMarkdown(node.children)}**`;
        case 'em':
          return `*${inlineToMarkdown(node.children)}*`;
        case 'link':
          return `[${inlineToMarkdown(node.children)}](${node.href})`;
      }
    })
    .join('');
}

const HEADING_RE = /^(#{2,3})\s+(.*)$/;
const QUOTE_RE = /^>\s?(.*)$/;
const CODE_FENCE_RE = /^(`{3,})\s*((?!title=)[^\s`]*)(?:\s+title="((?:\\.|[^"\\])*)")?\s*$/;
const CALLOUT_RE = /^\[!(highlight|note|flow)\](?:\s+(.*))?$/i;
const CLOSING_FENCE_RE = /^(`{3,})\s*$/;
const UNORDERED_ITEM_RE = /^[-*]\s+(.*)$/;
const ORDERED_ITEM_RE = /^\d+\.\s+(.*)$/;

function isBlank(line: string): boolean {
  return line.trim() === '';
}

export function splitTableRow(line: string): readonly string[] | null {
  let row = line.trim();
  if (!/(?<!\\)\|/.test(row)) return null;
  if (row.startsWith('|')) row = row.slice(1);
  if (row.endsWith('|') && !row.endsWith('\\|')) row = row.slice(0, -1);
  return row.split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, '|'));
}

const DELIMITER_CELL_RE = /^(:?)-+(:?)$/;

function tableAlign(line: string): readonly TableAlign[] | null {
  const cells = splitTableRow(line);
  if (cells === null) return null;
  const align: TableAlign[] = [];
  for (const cell of cells) {
    const match = DELIMITER_CELL_RE.exec(cell);
    if (match === null) return null;
    const left = match[1] === ':';
    const right = match[2] === ':';
    align.push(left && right ? 'center' : right ? 'right' : left ? 'left' : null);
  }
  return align;
}

function tableStart(lines: readonly string[], index: number): readonly TableAlign[] | null {
  const header = splitTableRow(lines[index] ?? '');
  const align = tableAlign(lines[index + 1] ?? '');
  return header !== null && align !== null && header.length === align.length ? align : null;
}

function quoteBlock(quoteLines: readonly string[]): Block {
  const [first = '', ...rest] = quoteLines;
  const callout = CALLOUT_RE.exec(first.trim());
  if (callout === null) return { type: 'quote', children: parseInline(quoteLines.join(' ').trim()) };

  const kind = (callout[1] ?? '').toLowerCase();
  const inline = (callout[2] ?? '').trim();
  const body = rest.join(' ').trim();
  if (kind === 'flow') {
    const steps = rest
      .map((line) => line.trim().replace(/^[-*]\s+/, ''))
      .filter((line) => line !== '')
      .map((line) => parseInline(line));
    return { type: 'flow', steps };
  }
  if (kind === 'note') {
    return { type: 'note', title: inline === '' ? null : parseInline(inline), children: parseInline(body) };
  }
  return { type: 'highlight', children: parseInline([inline, body].filter((part) => part !== '').join(' ')) };
}

export function parseBlocks(markdown: string): readonly Block[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? '';

    if (isBlank(line)) {
      index += 1;
      continue;
    }

    const fence = CODE_FENCE_RE.exec(line);
    if (fence !== null) {
      const fenceLength = fence[1]?.length ?? 3;
      const language = fence[2] === '' || fence[2] === undefined ? null : fence[2];
      const isClosing = (candidate: string): boolean =>
        (CLOSING_FENCE_RE.exec(candidate)?.[1]?.length ?? 0) >= fenceLength;
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !isClosing(lines[index] ?? '')) {
        codeLines.push(lines[index] ?? '');
        index += 1;
      }
      index += 1; // consome a cerca de fechamento, se houver
      const filename = fence[3] === undefined || fence[3].trim() === '' ? null : unescapeMarkdown(fence[3]);
      blocks.push({ type: 'code', code: codeLines.join('\n'), language, filename });
      continue;
    }

    const heading = HEADING_RE.exec(line);
    if (heading !== null) {
      const level = (heading[1]?.length ?? 2) as 2 | 3;
      blocks.push({ type: 'heading', level, children: parseInline(heading[2] ?? '') });
      index += 1;
      continue;
    }

    const align = tableStart(lines, index);
    if (align !== null) {
      const header = (splitTableRow(line) ?? []).map(parseInline);
      const rows: (readonly InlineNode[])[][] = [];
      index += 2;
      while (index < lines.length && !isBlank(lines[index] ?? '')) {
        const cells = splitTableRow(lines[index] ?? '');
        if (cells === null) break;
        rows.push(align.map((_, column) => parseInline(cells[column] ?? '')));
        index += 1;
      }
      blocks.push({ type: 'table', align, header, rows });
      continue;
    }

    const soloImage = IMAGE_RE.exec(line.trim());
    if (soloImage !== null) {
      const src = safeUrl(soloImage[2] ?? '');
      if (src !== null) {
        blocks.push({
          type: 'image',
          src,
          alt: unescapeMarkdown(soloImage[1] ?? ''),
          caption: soloImage[3] === undefined || soloImage[3] === '' ? null : unescapeMarkdown(soloImage[3]),
        });
        index += 1;
        continue;
      }
    }

    if (QUOTE_RE.test(line)) {
      const quoteLines: string[] = [];
      while (index < lines.length) {
        const match = QUOTE_RE.exec(lines[index] ?? '');
        if (match === null) break;
        quoteLines.push(match[1] ?? '');
        index += 1;
      }
      blocks.push(quoteBlock(quoteLines));
      continue;
    }

    const firstUnordered = UNORDERED_ITEM_RE.exec(line);
    const firstOrdered = ORDERED_ITEM_RE.exec(line);
    if (firstUnordered !== null || firstOrdered !== null) {
      const ordered = firstOrdered !== null;
      const itemRe = ordered ? ORDERED_ITEM_RE : UNORDERED_ITEM_RE;
      const items: (readonly InlineNode[])[] = [];
      while (index < lines.length) {
        const match = itemRe.exec(lines[index] ?? '');
        if (match === null) break;
        items.push(parseInline(match[1] ?? ''));
        index += 1;
      }
      blocks.push({ type: 'list', ordered, items });
      continue;
    }

    const paragraphLines: string[] = [];
    while (
      index < lines.length &&
      !isBlank(lines[index] ?? '') &&
      !HEADING_RE.test(lines[index] ?? '') &&
      !QUOTE_RE.test(lines[index] ?? '') &&
      !CODE_FENCE_RE.test(lines[index] ?? '') &&
      !UNORDERED_ITEM_RE.test(lines[index] ?? '') &&
      !ORDERED_ITEM_RE.test(lines[index] ?? '') &&
      tableStart(lines, index) === null
    ) {
      paragraphLines.push((lines[index] ?? '').trim());
      index += 1;
    }
    const joined = paragraphLines.join(' ').trim();
    if (joined !== '') {
      blocks.push({ type: 'paragraph', children: parseInline(joined) });
    }
  }

  return blocks;
}

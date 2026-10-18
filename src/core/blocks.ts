/**
 * O corpo de uma publicação, de Markdown para uma árvore de blocos.
 *
 * O banco guarda um `text` só (`PublicationTranslation::body`); quem decide
 * como ele se divide em título, parágrafo, citação, lista, código e imagem é
 * este módulo — uma vez, em TypeScript puro, consumido tanto pelo prerender
 * (Node) quanto pelo cliente. Mesmo princípio do `core/seo.ts` na fase 9: o
 * Laravel só guarda e devolve a string crua.
 *
 * Deliberadamente não é Markdown completo: sem tabela, sem HTML embutido, sem
 * lista aninhada, sem item de lista em múltiplas linhas. O acervo é de
 * artigos técnicos de um autor só, e cada recurso a mais é uma nova superfície
 * de parsing para manter e testar. Ver a spec da fase 11.
 *
 * Nunca produz HTML: a árvore é renderizada como elementos React normais, e o
 * texto sai escapado pelo próprio React. O único vetor que resta é a URL de
 * link e imagem — por isso `safeUrl` existe.
 */

export type InlineNode =
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'strong'; readonly children: readonly InlineNode[] }
  | { readonly type: 'em'; readonly children: readonly InlineNode[] }
  | { readonly type: 'code'; readonly text: string }
  | { readonly type: 'link'; readonly href: string; readonly children: readonly InlineNode[] };

export type Block =
  | { readonly type: 'heading'; readonly level: 2 | 3; readonly children: readonly InlineNode[] }
  | { readonly type: 'paragraph'; readonly children: readonly InlineNode[] }
  | { readonly type: 'quote'; readonly children: readonly InlineNode[] }
  | {
      readonly type: 'list';
      readonly ordered: boolean;
      readonly items: readonly (readonly InlineNode[])[];
    }
  | { readonly type: 'code'; readonly code: string; readonly language: string | null }
  | {
      readonly type: 'image';
      readonly src: string;
      readonly alt: string;
      readonly caption: string | null;
    };

// ---------------------------------------------------------------------------
// URLs
// ---------------------------------------------------------------------------

/**
 * Protocolos aceitos em `href`/`src`, mais raiz-relativo (`/...`) e âncora
 * (`#...`). Uma URL fora desta lista nunca é descartada — o texto do link ou
 * o `alt` da imagem permanece, só perde o elemento clicável/carregável.
 */
function safeUrl(url: string): string | null {
  const trimmed = url.trim();
  if (trimmed === '') return null;
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) return trimmed;
  if (/^(https?|mailto):/i.test(trimmed)) return trimmed;
  return null;
}

// ---------------------------------------------------------------------------
// Inline
// ---------------------------------------------------------------------------

const IMAGE_RE = /^!\[([^\]]*)\]\(([^)"]*)(?:\s+"([^"]*)")?\)$/;

/**
 * Um token por vez, na ordem de precedência que impede sobreposição: código
 * primeiro (protege o conteúdo de qualquer outra marcação), depois link,
 * depois negrito, depois itálico.
 */
const INLINE_TOKEN_RE =
  /`(?<code>[^`]+)`|!\[(?<imageAlt>[^\]]*)\]\([^)]*\)|\[(?<linkText>[^\]]*)\]\((?<linkHref>[^)"]*)(?:\s+"[^"]*")?\)|\*\*(?<strong>[^*]+)\*\*|\*(?<em1>[^*]+)\*|_(?<em2>[^_]+)_/g;

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

    if (groups.code !== undefined) {
      nodes.push({ type: 'code', text: groups.code });
    } else if (groups.imageAlt !== undefined) {
      // A spec trata imagem como bloco, nunca como marca inline: no meio de
      // um parágrafo a sintaxe `![alt](...)` sobra só como o `alt`.
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

/**
 * O inverso de `parseInline`: uma árvore de volta para o mesmo subconjunto de
 * Markdown. Usado só para migrar o corpo já publicado para os blocos do RDM
 * Studio (ver `core/draftBlocks.ts`) — nunca no caminho de leitura, que já
 * tem a árvore e nunca precisa do texto de volta.
 *
 * Sem escapar nada: um nó de texto é exatamente o que `parseInline` não
 * reconheceu como marcação, então devolvê-lo cru reproduz o original.
 */
export function inlineToMarkdown(nodes: readonly InlineNode[]): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case 'text':
          return node.text;
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

// ---------------------------------------------------------------------------
// Blocos
// ---------------------------------------------------------------------------

const HEADING_RE = /^(#{2,3})\s+(.*)$/;
const QUOTE_RE = /^>\s?(.*)$/;
const CODE_FENCE_RE = /^```\s*([^\s]*)\s*$/;
const UNORDERED_ITEM_RE = /^[-*]\s+(.*)$/;
const ORDERED_ITEM_RE = /^\d+\.\s+(.*)$/;

function isBlank(line: string): boolean {
  return line.trim() === '';
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
      const language = fence[1] === '' || fence[1] === undefined ? null : fence[1];
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !CODE_FENCE_RE.test(lines[index] ?? '')) {
        codeLines.push(lines[index] ?? '');
        index += 1;
      }
      index += 1; // consome a cerca de fechamento, se houver
      blocks.push({ type: 'code', code: codeLines.join('\n'), language });
      continue;
    }

    const heading = HEADING_RE.exec(line);
    if (heading !== null) {
      const level = (heading[1]?.length ?? 2) as 2 | 3;
      blocks.push({ type: 'heading', level, children: parseInline(heading[2] ?? '') });
      index += 1;
      continue;
    }

    const soloImage = IMAGE_RE.exec(line.trim());
    if (soloImage !== null) {
      const src = safeUrl(soloImage[2] ?? '');
      if (src !== null) {
        blocks.push({
          type: 'image',
          src,
          alt: soloImage[1] ?? '',
          caption: soloImage[3] === undefined || soloImage[3] === '' ? null : soloImage[3],
        });
        index += 1;
        continue;
      }
      // Protocolo recusado: cai para o tratamento de parágrafo abaixo, que
      // preserva o `alt` como texto em vez de descartar a linha inteira.
    }

    if (QUOTE_RE.test(line)) {
      const quoteLines: string[] = [];
      while (index < lines.length) {
        const match = QUOTE_RE.exec(lines[index] ?? '');
        if (match === null) break;
        quoteLines.push(match[1] ?? '');
        index += 1;
      }
      blocks.push({ type: 'quote', children: parseInline(quoteLines.join(' ').trim()) });
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

    // Parágrafo: consome linhas seguidas até a próxima linha em branco ou o
    // início de outro tipo de bloco, e as reflui numa só, como Markdown faz.
    const paragraphLines: string[] = [];
    while (
      index < lines.length &&
      !isBlank(lines[index] ?? '') &&
      !HEADING_RE.test(lines[index] ?? '') &&
      !QUOTE_RE.test(lines[index] ?? '') &&
      !CODE_FENCE_RE.test(lines[index] ?? '') &&
      !UNORDERED_ITEM_RE.test(lines[index] ?? '') &&
      !ORDERED_ITEM_RE.test(lines[index] ?? '')
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

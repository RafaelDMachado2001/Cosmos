import { charCount } from './measure';
import { DIRECTIVE_RE, ID_RE, closest, hasOddQuotes, sortedErrors } from './parseText';
import type { SourceLine } from './parseText';
import type { DiagramError, DiagramParseResult, LayerBand, LayerGroup, LayerItems, LayerNode } from './types';

export const LAYERS_LIMITS = {
  depth: 5,
  items: 60,
  item: 32,
  name: 28,
  note: 48,
  asides: 2,
} as const;

const INDENT_STEP = 2;
const KEYWORDS = ['group', 'base', 'aside'] as const;
const HIGHLIGHT = 'highlight';

const LAYER_RE = /^(\S+)\s+"([^"]*)"\s*(.*)$/;
const GROUP_RE = /^group\s+"([^"]*)"\s*(.*)$/;
const BAND_RE = /^(base|aside)\s+"([^"]*)"\s*(.*)$/;
const NOTE_HIGHLIGHT_RE = /^(.*?)\s*\bhighlight$/;

const LEVEL_WORDS = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis'];

interface LayerDraft {
  readonly kind: 'layer';
  readonly id: string;
  readonly name: string;
  readonly note: string | null;
  readonly highlight: boolean;
  readonly depth: number;
  readonly children: (LayerItems | LayerGroup | LayerDraft)[];
  readonly line: number;
  claimed: boolean;
}

interface GroupDraft {
  readonly kind: 'group';
  readonly name: string;
  readonly highlight: boolean;
  readonly items: string[];
  readonly line: number;
}

interface BandDraft {
  readonly kind: 'base' | 'aside';
  readonly name: string;
  readonly note: string | null;
  readonly items: string[];
  readonly line: number;
}

type Container = LayerDraft | GroupDraft | BandDraft;

interface OpenList {
  readonly target: string[];
  readonly line: number;
}

interface Pending {
  readonly target: string[];
  readonly indent: number;
  readonly line: number;
}

export function splitItems(text: string): string[] {
  const items: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of text) {
    if (char === '(') depth += 1;
    if (char === ')') depth = Math.max(0, depth - 1);
    if (char === ',' && depth === 0) {
      items.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  items.push(current.trim());
  return items;
}

function levelWord(levels: number): string {
  return LEVEL_WORDS[levels] ?? String(levels);
}

export function parseLayers(
  id: string,
  body: readonly SourceLine[],
  headerLine: number,
  headerErrors: readonly DiagramError[],
): DiagramParseResult {
  const errors = [...headerErrors];
  const fail = (line: number, message: string): void => {
    errors.push({ line, message });
  };
  const checkLength = (line: number, text: string, max: number, what: string): void => {
    const length = charCount(text);
    if (length > max) fail(line, `${what} com ${String(length)} caracteres; o máximo é ${String(max)}`);
  };

  let title: string | null = null;
  let titleLine: number | null = null;
  let root: LayerDraft | null = null;
  let base: BandDraft | null = null;
  const asides: BandDraft[] = [];
  const layers: LayerDraft[] = [];
  const layerLines = new Map<string, number>();
  let stack: Container[] = [];
  let pending: Pending | null = null;
  let itemCount = 0;
  const list: { open: OpenList | null } = { open: null };
  const openList = (): OpenList | null => list.open;

  const addItems = (line: number, target: string[], text: string): void => {
    const continues = text.endsWith(',');
    for (const item of splitItems(continues ? text.slice(0, -1) : text)) {
      if (item === '') {
        fail(line, 'item vazio; separe os itens com uma vírgula só');
        continue;
      }
      checkLength(line, item, LAYERS_LIMITS.item, `item "${item}"`);
      itemCount += 1;
      if (itemCount === LAYERS_LIMITS.items + 1) {
        fail(line, `mais de ${String(LAYERS_LIMITS.items)} itens; o máximo é ${String(LAYERS_LIMITS.items)}`);
      }
      target.push(item);
    }
    list.open = continues ? { target, line } : null;
  };

  const unknownWord = (line: number, word: string): boolean => {
    const hint = closest(word, KEYWORDS);
    if (hint === null) return false;
    fail(line, `palavra desconhecida "${word}". Você quis dizer "${hint}"?`);
    return true;
  };

  const readNoteAndHighlight = (
    line: number,
    rest: string,
  ): { readonly note: string | null; readonly highlight: boolean } | null => {
    if (rest === '') return { note: null, highlight: false };
    if (rest === HIGHLIGHT) return { note: null, highlight: true };
    if (!rest.startsWith('/')) return null;
    let note = rest.slice(1).trim();
    let highlight = false;
    const flagged = NOTE_HIGHLIGHT_RE.exec(note);
    if (flagged !== null) {
      note = flagged[1] ?? '';
      highlight = true;
    }
    if (note === '') return { note: null, highlight };
    checkLength(line, note, LAYERS_LIMITS.note, 'nota');
    return { note, highlight };
  };

  const parentAt = (line: number, level: number, what: string): LayerDraft | null => {
    const parent = stack[level - 1];
    if (parent === undefined) {
      let nearest = level - 1;
      while (nearest >= 0 && stack[nearest]?.kind !== 'layer') nearest -= 1;
      const ancestor = stack[nearest];
      if (ancestor === undefined || ancestor.kind !== 'layer') {
        fail(line, `${what} está indentado, mas não há camada acima`);
      } else {
        ancestor.claimed = true;
        fail(line, `${what} está ${levelWord(level - nearest)} níveis abaixo de "${ancestor.id}"; falta uma camada no meio?`);
      }
      return null;
    }
    if (parent.kind === 'group') {
      fail(line, 'um grupo não pode ter camadas dentro');
      return null;
    }
    if (parent.kind !== 'layer') {
      fail(line, `"${parent.kind}" não pode ter camadas dentro`);
      return null;
    }
    parent.claimed = true;
    return parent;
  };

  const readDirective = (line: number, level: number, name: string, value: string): void => {
    if (name === 'direction') {
      fail(line, '"direction" não se aplica a layers');
      return;
    }
    if (name !== 'title') {
      if (!unknownWord(line, name)) fail(line, `diretiva desconhecida "${name}". Use "title"`);
      return;
    }
    if (level > 0) {
      fail(line, '"title" só pode aparecer fora da pilha (sem indentação)');
      return;
    }
    if (titleLine !== null) {
      fail(line, `"title" repetido; já declarado na linha ${String(titleLine)}`);
      return;
    }
    titleLine = line;
    if (value === '') fail(line, '"title" sem texto');
    else title = value;
  };

  const readItemsLine = (line: number, level: number, text: string): void => {
    const owner = level === 0 ? undefined : stack[level - 1];
    if (owner?.kind === 'layer') {
      owner.claimed = true;
      const items: string[] = [];
      owner.children.push({ kind: 'items', items, line });
      addItems(line, items, text.slice(1).trim());
      return;
    }
    if ((owner?.kind === 'base' || owner?.kind === 'aside') && level === 1) {
      addItems(line, owner.items, text.slice(1).trim());
      return;
    }
    fail(line, 'itens sem camada; a linha ": ..." precisa ficar logo abaixo de uma camada');
  };

  const readGroup = (line: number, level: number, match: RegExpExecArray): Container | null => {
    const name = match[1] ?? '';
    const rest = match[2] ?? '';
    const flags = /^(highlight\s*)?:\s*(.*)$/.exec(rest);
    if (name.trim() === '') fail(line, 'grupo sem nome');
    checkLength(line, name, LAYERS_LIMITS.name, 'nome');
    if (flags === null) {
      fail(line, `grupo sem itens. Use: group "${name}": a, b`);
      return null;
    }
    if (level === 0) {
      fail(line, 'um grupo precisa ficar dentro de uma camada');
      return null;
    }
    const parent = parentAt(line, level, `o grupo "${name}"`);
    if (parent === null) return null;
    const group: GroupDraft = { kind: 'group', name, highlight: flags[1] !== undefined, items: [], line };
    parent.children.push(group);
    const items = flags[2] ?? '';
    if (items === '') fail(line, `o grupo "${name}" está vazio`);
    else addItems(line, group.items, items);
    return group;
  };

  const readBand = (line: number, level: number, match: RegExpExecArray): Container | null => {
    const kind = match[1] === 'base' ? 'base' : 'aside';
    const name = match[2] ?? '';
    const rest = match[3] ?? '';
    if (level > 0) {
      fail(line, `"${kind}" só pode aparecer fora da pilha (sem indentação)`);
      return null;
    }
    const colon = rest.indexOf(':');
    const head = colon === -1 ? rest : rest.slice(0, colon).trim();
    const inline = colon === -1 ? null : rest.slice(colon + 1).trim();
    const noted = readNoteAndHighlight(line, head);
    if (noted === null || noted.highlight) {
      fail(line, `linha inválida. Use: ${kind} "Nome" / nota: a, b`);
      return null;
    }
    if (name.trim() === '') fail(line, `"${kind}" sem nome`);
    checkLength(line, name, LAYERS_LIMITS.name, 'nome');
    const band: BandDraft = { kind, name, note: noted.note, items: [], line };
    if (kind === 'base') {
      if (base !== null) fail(line, 'só pode existir um "base"');
      else base = band;
    } else if (asides.length === LAYERS_LIMITS.asides) {
      fail(line, `só podem existir ${String(LAYERS_LIMITS.asides)} "aside"`);
    } else {
      asides.push(band);
    }
    if (inline !== null && inline !== '') addItems(line, band.items, inline);
    return band;
  };

  const readLayer = (line: number, level: number, text: string): Container | null => {
    const match = LAYER_RE.exec(text);
    const word = text.split(/[\s":]+/)[0] ?? text;
    if (match === null) {
      if (!unknownWord(line, word)) {
        fail(line, 'linha inválida. Use: id "Nome" / nota, group "Nome": a, b, ou ": a, b"');
      }
      return null;
    }
    const layerId = match[1] ?? '';
    const name = match[2] ?? '';
    const rest = (match[3] ?? '').trim();
    if (/^(highlight\s*)?:/.test(rest)) {
      if (!unknownWord(line, layerId)) {
        fail(line, `a camada "${layerId}" não leva itens na mesma linha; ponha ": a, b" na linha de baixo`);
      }
      return null;
    }
    const noted = readNoteAndHighlight(line, rest);
    if (noted === null) {
      fail(line, `linha inválida. Use: ${layerId} "${name}" / nota`);
      return null;
    }
    if (!ID_RE.test(layerId)) {
      fail(line, `id "${layerId}" inválido; use minúsculas, números e hífen, começando por letra`);
    }
    if (name.trim() === '') fail(line, `o nome da camada "${layerId}" está vazio`);
    checkLength(line, name, LAYERS_LIMITS.name, 'nome');

    let depth = 1;
    let parent: LayerDraft | null = null;
    if (level === 0) {
      if (root !== null) {
        fail(line, `só pode existir uma camada raiz; "${root.id}" já está na linha ${String(root.line)}`);
        return null;
      }
    } else {
      parent = parentAt(line, level, `"${layerId}"`);
      if (parent === null) return null;
      depth = parent.depth + 1;
      if (depth > LAYERS_LIMITS.depth) {
        fail(line, `"${layerId}" fica na profundidade ${String(depth)}; o máximo é ${String(LAYERS_LIMITS.depth)}`);
      }
    }

    const earlier = layerLines.get(layerId);
    if (earlier !== undefined) fail(line, `id "${layerId}" repetido; já declarado na linha ${String(earlier)}`);
    else layerLines.set(layerId, line);

    const layer: LayerDraft = {
      kind: 'layer',
      id: layerId,
      name,
      note: noted.note,
      highlight: noted.highlight,
      depth,
      children: [],
      line,
      claimed: false,
    };
    layers.push(layer);
    if (parent === null) root = layer;
    else parent.children.push(layer);
    return layer;
  };

  for (const { number, text, indent } of body) {
    if (indent.includes('\t')) {
      fail(number, 'tab na indentação; use 2 espaços por nível');
      pending = null;
      continue;
    }
    const width = indent.length;
    list.open = null;

    if (pending !== null) {
      if (width > pending.indent) {
        if (hasOddQuotes(text)) fail(number, 'aspas sem fechar');
        else addItems(number, pending.target, text);
        const open = openList();
        pending = open === null ? null : { ...open, indent: pending.indent };
        continue;
      }
      fail(pending.line, 'a lista termina em vírgula, mas a linha seguinte não continua');
      pending = null;
    }

    if (width % INDENT_STEP !== 0) {
      fail(number, `indentação de ${String(width)} espaços; use múltiplos de ${String(INDENT_STEP)}`);
      continue;
    }
    const level = width / INDENT_STEP;

    if (hasOddQuotes(text)) {
      fail(number, 'aspas sem fechar');
      continue;
    }

    const directive = DIRECTIVE_RE.exec(text);
    if (directive !== null) {
      readDirective(number, level, directive[1] ?? '', directive[2] ?? '');
      continue;
    }

    let opened: Container | null = null;
    const group = GROUP_RE.exec(text);
    const band = BAND_RE.exec(text);
    if (text.startsWith(':')) readItemsLine(number, level, text);
    else if (group !== null) opened = readGroup(number, level, group);
    else if (band !== null) opened = readBand(number, level, band);
    else opened = readLayer(number, level, text);

    stack = stack.slice(0, level);
    if (opened !== null) stack[level] = opened;
    const open = openList();
    if (open !== null) pending = { ...open, indent: width };
  }
  if (pending !== null) fail(pending.line, 'a lista termina em vírgula, mas a linha seguinte não continua');

  for (const layer of layers) {
    if (layer.children.length === 0 && !layer.claimed) fail(layer.line, `a camada "${layer.id}" está vazia`);
  }
  for (const band of [base, ...asides]) {
    if (band !== null && band.items.length === 0) fail(band.line, `"${band.kind}" sem itens`);
  }
  if (root === null && errors.length === 0) {
    fail(headerLine, 'o diagrama não tem camada. Declare a raiz: id "Nome"');
  }

  if (errors.length > 0 || root === null) return { ok: false, errors: sortedErrors(errors) };

  const band = (draft: BandDraft): LayerBand => ({
    name: draft.name,
    note: draft.note,
    items: draft.items,
    line: draft.line,
  });
  const finish = (draft: LayerDraft): LayerNode => ({
    kind: 'layer',
    id: draft.id,
    name: draft.name,
    note: draft.note,
    highlight: draft.highlight,
    depth: draft.depth,
    children: draft.children.map((child) => (child.kind === 'layer' ? finish(child) : child)),
    line: draft.line,
  });

  return {
    ok: true,
    diagram: {
      kind: 'layers',
      id,
      title,
      root: finish(root),
      base: base === null ? null : band(base),
      asides: asides.map(band),
    },
  };
}

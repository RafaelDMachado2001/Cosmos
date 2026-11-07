import { charCount } from './measure';
import type {
  DiagramDirection,
  DiagramEdge,
  DiagramEdgeMark,
  DiagramError,
  DiagramNode,
  DiagramNodeMark,
  DiagramParseResult,
  DiagramState,
} from './types';

export const DIAGRAM_SOURCE_MAX_LENGTH = 4000;

export const DIAGRAM_LIMITS = {
  nodes: 12,
  edges: 16,
  nodeLabel: 28,
  nodeSub: 24,
  edgeLabel: 28,
  edgeShort: 12,
  states: 6,
  stateLabel: 20,
  stateTitle: 60,
  stateText: 280,
  stateHint: 120,
} as const;

const ID_RE = /^[a-z][a-z0-9-]*$/;
const DIRECTIVE_RE = /^([\p{L}_-]+)\s*:\s*(.*)$/u;
const NODE_RE = /^(\S+)\s+"([^"]*)"\s*(?:\/\s*(.*))?$/;
const EDGE_TARGET_RE = /^(\S+?)\s*(?::\s*([^|]*?))?\s*(?:\|\s*(.*?))?\s*$/;
const HEADER_RE = /^([\p{L}]+)(?:\s+([^\s":]+))?$/u;

const STATE_RE = /^state(?:\s+(.*))?$/;
const STATE_LABEL_RE = /^(?:"([^"]*)"|(\S+))$/;
const STATE_EDGE_RE = /^(\S+?)\s*->\s*(\S+)(?:\s+(\S+))?$/;

const DIRECTIONS: readonly DiagramDirection[] = ['auto', 'right', 'down'];
const DIRECTIVES = ['title', 'direction'] as const;
const PLANNED_KINDS: readonly string[] = ['compare', 'sequence'];
const STATE_DIRECTIVES = ['title', 'text', 'hint'] as const;
const EDGE_MARKS: readonly DiagramEdgeMark[] = ['broken', 'slow'];
const NODE_MARKS: readonly DiagramNodeMark[] = ['down', 'slow'];
const STATE_FIELD_LIMITS = {
  title: DIAGRAM_LIMITS.stateTitle,
  text: DIAGRAM_LIMITS.stateText,
  hint: DIAGRAM_LIMITS.stateHint,
} as const;

interface StateDraft {
  label: string;
  title: string | null;
  text: string | null;
  hint: string | null;
  path: readonly string[];
  readonly edges: { readonly from: string; readonly to: string; readonly mark: DiagramEdgeMark }[];
  readonly nodes: { readonly id: string; readonly mark: DiagramNodeMark }[];
  readonly line: number;
  readonly seen: Map<string, number>;
}

function stripComment(line: string): string {
  let quoted = false;
  for (const [index, char] of [...line].entries()) {
    if (char === '"') quoted = !quoted;
    if (char === '#' && !quoted) return [...line].slice(0, index).join('');
  }
  return line;
}

function hasOddQuotes(line: string): boolean {
  return line.split('"').length % 2 === 0;
}

function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let row = 1; row <= a.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= b.length; column += 1) {
      const cost = a[row - 1] === b[column - 1] ? 0 : 1;
      current.push(
        Math.min(
          (previous[column] ?? 0) + 1,
          (current[column - 1] ?? 0) + 1,
          (previous[column - 1] ?? 0) + cost,
        ),
      );
    }
    previous = current;
  }
  return previous[b.length] ?? 0;
}

function closest(word: string, candidates: readonly string[]): string | null {
  const limit = Math.max(1, Math.floor(word.length / 2));
  let best: string | null = null;
  let bestDistance = limit + 1;
  for (const candidate of candidates) {
    const distance = editDistance(word, candidate);
    if (distance < bestDistance && distance < word.length) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

function cyclePaths(
  nodes: readonly DiagramNode[],
  edges: readonly DiagramEdge[],
): readonly { readonly line: number; readonly path: readonly string[] }[] {
  const outgoing = new Map<string, DiagramEdge[]>();
  for (const edge of edges) outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge]);

  const finished = new Set<string>();
  const trail: string[] = [];
  const found: { line: number; path: string[] }[] = [];

  const visit = (id: string): void => {
    trail.push(id);
    for (const edge of outgoing.get(id) ?? []) {
      const start = trail.indexOf(edge.to);
      if (start !== -1) found.push({ line: edge.line, path: [...trail.slice(start), edge.to] });
      else if (!finished.has(edge.to)) visit(edge.to);
    }
    trail.pop();
    finished.add(id);
  };

  for (const node of nodes) {
    if (!finished.has(node.id)) visit(node.id);
  }
  return found;
}

export function parseDiagram(source: string): DiagramParseResult {
  const errors: DiagramError[] = [];
  const fail = (line: number, message: string): void => {
    errors.push({ line, message });
  };

  const lines = source
    .split(/\r?\n/)
    .map((raw, index) => ({ number: index + 1, text: stripComment(raw).trim() }))
    .filter((line) => line.text !== '');

  const first = lines[0];
  if (first === undefined) {
    return { ok: false, errors: [{ line: 1, message: 'diagrama vazio. Comece com "flow <id>"' }] };
  }

  let id = '';
  const header = /->/.test(first.text) ? null : HEADER_RE.exec(first.text);
  let body = lines;
  if (header === null) {
    fail(first.number, 'comece com "flow <id>"');
  } else {
    body = lines.slice(1);
    const kind = header[1] ?? '';
    const name = header[2];
    if (PLANNED_KINDS.includes(kind)) {
      fail(first.number, `o tipo "${kind}" ainda não é suportado. Use "flow"`);
    } else if (kind !== 'flow') {
      fail(first.number, `tipo desconhecido "${kind}". Use "flow"`);
    } else if (name === undefined) {
      fail(first.number, 'falta o id do fluxo. Use "flow <id>"');
    } else if (!ID_RE.test(name)) {
      fail(first.number, `id "${name}" inválido; use minúsculas, números e hífen, começando por letra`);
    } else {
      id = name;
    }
  }

  let title: string | null = null;
  let direction: DiagramDirection = 'auto';
  const directiveLines = new Map<string, number>();
  const nodes: DiagramNode[] = [];
  const edges: DiagramEdge[] = [];
  const nodeLines = new Map<string, number>();
  const edgeLines = new Map<string, number>();

  const checkLength = (line: number, text: string, max: number, what: string): void => {
    const length = charCount(text);
    if (length > max) fail(line, `${what} com ${String(length)} caracteres; o máximo é ${String(max)}`);
  };

  const readDirective = (line: number, name: string, value: string): void => {
    if (name !== 'title' && name !== 'direction') {
      const hint = closest(name, DIRECTIVES);
      const options = hint === null ? 'Use "title" ou "direction"' : `Use "${hint}"`;
      fail(line, `diretiva desconhecida "${name}". ${options}`);
      return;
    }
    const earlier = directiveLines.get(name);
    if (earlier !== undefined) {
      fail(line, `"${name}" repetido; já declarado na linha ${String(earlier)}`);
      return;
    }
    directiveLines.set(name, line);
    if (name === 'title') {
      if (value === '') fail(line, '"title" sem texto');
      else title = value;
      return;
    }
    const chosen = DIRECTIONS.find((candidate) => candidate === value);
    if (chosen === undefined) fail(line, `direção "${value}" inválida. Use auto, right ou down`);
    else direction = chosen;
  };

  const readEdge = (line: number, text: string): void => {
    const arrow = text.indexOf('->');
    const from = text.slice(0, arrow).trim();
    const target = EDGE_TARGET_RE.exec(text.slice(arrow + 2).trim());
    const to = target?.[1];
    if (from === '' || /\s/.test(from) || target === null || to === undefined) {
      fail(line, 'aresta incompleta. Use: de -> para : rótulo | curto');
      return;
    }
    const label = target[2] === undefined || target[2] === '' ? null : target[2];
    const short = target[3] === undefined || target[3] === '' ? null : target[3];
    if (label !== null) checkLength(line, label, DIAGRAM_LIMITS.edgeLabel, 'rótulo');
    if (short !== null) checkLength(line, short, DIAGRAM_LIMITS.edgeShort, 'rótulo curto');
    if (edges.length === DIAGRAM_LIMITS.edges) {
      fail(line, `mais de ${String(DIAGRAM_LIMITS.edges)} arestas; o máximo é ${String(DIAGRAM_LIMITS.edges)}`);
    }
    edges.push({ from, to, label, short, line });
  };

  const readNode = (line: number, text: string): void => {
    const match = NODE_RE.exec(text);
    if (match === null) {
      const word = text.split(/\s+/)[0] ?? text;
      fail(line, `o rótulo do nó "${word}" precisa estar entre aspas: ${word} "Rótulo"`);
      return;
    }
    const nodeId = match[1] ?? '';
    const label = match[2] ?? '';
    const sub = match[3] === undefined || match[3].trim() === '' ? null : match[3].trim();

    if (!ID_RE.test(nodeId)) {
      fail(line, `id "${nodeId}" inválido; use minúsculas, números e hífen, começando por letra`);
    }
    if (label.trim() === '') fail(line, `o rótulo do nó "${nodeId}" está vazio`);
    checkLength(line, label, DIAGRAM_LIMITS.nodeLabel, 'rótulo');
    if (sub !== null) checkLength(line, sub, DIAGRAM_LIMITS.nodeSub, 'subtítulo');

    const earlier = nodeLines.get(nodeId);
    if (earlier !== undefined) {
      fail(line, `id "${nodeId}" repetido; já declarado na linha ${String(earlier)}`);
      return;
    }
    if (nodes.length === DIAGRAM_LIMITS.nodes) {
      fail(line, `mais de ${String(DIAGRAM_LIMITS.nodes)} nós; o máximo é ${String(DIAGRAM_LIMITS.nodes)}`);
    }
    nodeLines.set(nodeId, line);
    nodes.push({ id: nodeId, label, sub, line });
  };

  const states: StateDraft[] = [];

  const unknownNode = (line: number, id: string): void => {
    const hint = closest(
      id,
      nodes.map((node) => node.id),
    );
    fail(line, `o nó "${id}" não foi declarado.${hint === null ? '' : ` Você quis dizer "${hint}"?`}`);
  };

  const hasEdge = (from: string, to: string): boolean =>
    edges.some((edge) => edge.from === from && edge.to === to);

  const claim = (state: StateDraft, line: number, key: string, what: string): boolean => {
    const earlier = state.seen.get(key);
    if (earlier !== undefined) {
      fail(line, `${what} repetido; já declarado na linha ${String(earlier)}`);
      return false;
    }
    state.seen.set(key, line);
    return true;
  };

  const openState = (line: number, rest: string): void => {
    const match = STATE_LABEL_RE.exec(rest);
    const label = (match?.[1] ?? match?.[2] ?? '').trim();
    if (label === '') {
      fail(line, 'estado sem nome. Use: state "nome"');
    } else {
      checkLength(line, label, DIAGRAM_LIMITS.stateLabel, 'nome do estado');
      const earlier = states.find((state) => state.label === label);
      if (earlier !== undefined) fail(line, `estado "${label}" repetido; já declarado na linha ${String(earlier.line)}`);
    }
    if (states.length === DIAGRAM_LIMITS.states) {
      fail(line, `mais de ${String(DIAGRAM_LIMITS.states)} estados; o máximo é ${String(DIAGRAM_LIMITS.states)}`);
    }
    states.push({ label, title: null, text: null, hint: null, path: [], edges: [], nodes: [], line, seen: new Map() });
  };

  const readStateDirective = (state: StateDraft, line: number, name: string, value: string): void => {
    const field = STATE_DIRECTIVES.find((candidate) => candidate === name);
    if (field === undefined) {
      const hint = closest(name, STATE_DIRECTIVES);
      fail(line, `diretiva desconhecida "${name}" no estado. ${hint === null ? 'Use "title", "text" ou "hint"' : `Use "${hint}"`}`);
      return;
    }
    if (!claim(state, line, field, `"${field}"`)) return;
    if (value === '') {
      fail(line, `"${field}" sem texto`);
      return;
    }
    checkLength(line, value, STATE_FIELD_LIMITS[field], `"${field}"`);
    state[field] = value;
  };

  const readStatePath = (state: StateDraft, line: number, ids: readonly string[]): void => {
    if (!claim(state, line, 'path', '"path"')) return;
    if (ids.length < 2) {
      fail(line, 'o caminho precisa de ao menos dois nós: path a b');
      return;
    }
    const unknown = ids.filter((id) => !nodeLines.has(id));
    for (const id of unknown) unknownNode(line, id);
    if (unknown.length > 0) return;
    for (const [index, to] of ids.slice(1).entries()) {
      const from = ids[index] ?? '';
      if (!hasEdge(from, to)) fail(line, `o caminho usa ${from} -> ${to}, aresta que o fluxo não tem`);
    }
    state.path = ids;
  };

  const readStateEdge = (state: StateDraft, line: number, text: string): void => {
    const match = STATE_EDGE_RE.exec(text);
    const from = match?.[1];
    const to = match?.[2];
    if (match === null || from === undefined || to === undefined) {
      fail(line, 'aresta incompleta no estado. Use: de -> para broken');
      return;
    }
    const word = match[3] ?? '';
    const mark = EDGE_MARKS.find((candidate) => candidate === word);
    if (mark === undefined) {
      const hint = closest(word, EDGE_MARKS);
      fail(line, `marca "${word}" inválida na aresta. Use ${hint === null ? 'broken ou slow' : `"${hint}"`}`);
      return;
    }
    if (!nodeLines.has(from) || !nodeLines.has(to)) {
      for (const id of [from, to]) if (!nodeLines.has(id)) unknownNode(line, id);
      return;
    }
    if (!hasEdge(from, to)) {
      fail(line, `a aresta ${from} -> ${to} não existe no fluxo`);
      return;
    }
    if (claim(state, line, `${from} -> ${to}`, `aresta ${from} -> ${to}`)) state.edges.push({ from, to, mark });
  };

  const readStateNode = (state: StateDraft, line: number, words: readonly string[]): void => {
    const id = words[0] ?? '';
    const mark = NODE_MARKS.find((candidate) => candidate === words[1]);
    if (words.length !== 2 || words[1] === undefined || words[1].startsWith('"')) {
      fail(line, `linha inválida no estado. Use: ${id} down, ou declare nós e arestas antes do primeiro "state"`);
      return;
    }
    if (mark === undefined) {
      const hint = closest(words[1], NODE_MARKS);
      fail(line, `marca "${words[1]}" inválida no nó. Use ${hint === null ? 'down ou slow' : `"${hint}"`}`);
      return;
    }
    if (!nodeLines.has(id)) {
      unknownNode(line, id);
      return;
    }
    if (claim(state, line, `node:${id}`, `nó "${id}"`)) state.nodes.push({ id, mark });
  };

  const readStateLine = (state: StateDraft, line: number, text: string): void => {
    const directive = DIRECTIVE_RE.exec(text);
    if (directive !== null) {
      readStateDirective(state, line, directive[1] ?? '', directive[2] ?? '');
      return;
    }
    if (text.includes('->')) {
      readStateEdge(state, line, text);
      return;
    }
    const words = text.split(/\s+/);
    if (words[0] === 'path') readStatePath(state, line, words.slice(1));
    else readStateNode(state, line, words);
  };

  for (const { number, text } of body) {
    if (hasOddQuotes(text)) {
      fail(number, 'aspas sem fechar');
      continue;
    }
    const opening = STATE_RE.exec(text);
    const current = states.at(-1);
    if (opening !== null) {
      openState(number, opening[1]?.trim() ?? '');
      continue;
    }
    if (current !== undefined) {
      readStateLine(current, number, text);
      continue;
    }
    const directive = DIRECTIVE_RE.exec(text);
    if (directive !== null) readDirective(number, directive[1] ?? '', directive[2] ?? '');
    else if (text.includes('->')) readEdge(number, text);
    else readNode(number, text);
  }

  const resolvable: DiagramEdge[] = [];
  for (const edge of edges) {
    let resolved = true;
    for (const end of [edge.from, edge.to]) {
      if (nodeLines.has(end)) continue;
      resolved = false;
      unknownNode(edge.line, end);
    }
    const key = `${edge.from} -> ${edge.to}`;
    const earlier = edgeLines.get(key);
    if (earlier !== undefined) {
      fail(edge.line, `aresta ${key} repetida; já declarada na linha ${String(earlier)}`);
      continue;
    }
    edgeLines.set(key, edge.line);
    if (resolved) resolvable.push(edge);
  }

  for (const { line, path } of cyclePaths(nodes, resolvable)) {
    fail(line, `este fluxo tem um ciclo (${path.join(' -> ')}). Ciclos ainda não são suportados`);
  }

  for (const state of states) {
    if (state.path.length === 0 && state.edges.length === 0 && state.nodes.length === 0 && errors.length === 0) {
      fail(state.line, `o estado "${state.label}" não marca nada. Use path, uma aresta ou um nó`);
    }
  }

  if (nodes.length === 0 && errors.length === 0) {
    fail(first.number, 'o fluxo não tem nós. Declare ao menos um: id "Rótulo"');
  }

  if (errors.length > 0) {
    return { ok: false, errors: [...errors].sort((a, b) => a.line - b.line) };
  }

  const finished = states.map(
    (state): DiagramState => ({
      label: state.label,
      title: state.title,
      text: state.text,
      hint: state.hint,
      path: state.path,
      edges: state.edges,
      nodes: state.nodes,
      line: state.line,
    }),
  );
  return { ok: true, diagram: { kind: 'flow', id, title, direction, nodes, edges, states: finished } };
}

export function diagramErrorMessages(source: string): readonly string[] {
  if (charCount(source) > DIAGRAM_SOURCE_MAX_LENGTH) {
    return [`diagrama com ${String(charCount(source))} caracteres; o máximo é ${String(DIAGRAM_SOURCE_MAX_LENGTH)}`];
  }
  const result = parseDiagram(source);
  if (result.ok) return [];
  return result.errors.map((error) => `linha ${String(error.line)}: ${error.message}`);
}

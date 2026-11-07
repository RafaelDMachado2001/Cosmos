import { charCount } from './measure';
import type {
  DiagramDirection,
  DiagramEdge,
  DiagramError,
  DiagramNode,
  DiagramParseResult,
} from './types';

export const DIAGRAM_SOURCE_MAX_LENGTH = 4000;

export const DIAGRAM_LIMITS = {
  nodes: 12,
  edges: 16,
  nodeLabel: 28,
  nodeSub: 24,
  edgeLabel: 28,
  edgeShort: 12,
} as const;

const ID_RE = /^[a-z][a-z0-9-]*$/;
const DIRECTIVE_RE = /^([\p{L}_-]+)\s*:\s*(.*)$/u;
const NODE_RE = /^(\S+)\s+"([^"]*)"\s*(?:\/\s*(.*))?$/;
const EDGE_TARGET_RE = /^(\S+?)\s*(?::\s*([^|]*?))?\s*(?:\|\s*(.*?))?\s*$/;
const HEADER_RE = /^([\p{L}]+)(?:\s+([^\s":]+))?$/u;

const DIRECTIONS: readonly DiagramDirection[] = ['auto', 'right', 'down'];
const DIRECTIVES = ['title', 'direction'] as const;
const PLANNED_KINDS: readonly string[] = ['compare', 'sequence'];

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

  for (const { number, text } of body) {
    if (hasOddQuotes(text)) {
      fail(number, 'aspas sem fechar');
      continue;
    }
    const directive = DIRECTIVE_RE.exec(text);
    if (directive !== null) readDirective(number, directive[1] ?? '', directive[2] ?? '');
    else if (text.includes('->')) readEdge(number, text);
    else readNode(number, text);
  }

  const known = nodes.map((node) => node.id);
  const resolvable: DiagramEdge[] = [];
  for (const edge of edges) {
    let resolved = true;
    for (const end of [edge.from, edge.to]) {
      if (nodeLines.has(end)) continue;
      resolved = false;
      const hint = closest(end, known);
      fail(
        edge.line,
        `o nó "${end}" não foi declarado.${hint === null ? '' : ` Você quis dizer "${hint}"?`}`,
      );
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

  if (nodes.length === 0 && errors.length === 0) {
    fail(first.number, 'o fluxo não tem nós. Declare ao menos um: id "Rótulo"');
  }

  if (errors.length > 0) {
    return { ok: false, errors: [...errors].sort((a, b) => a.line - b.line) };
  }

  return { ok: true, diagram: { kind: 'flow', id, title, direction, nodes, edges } };
}

export function diagramErrorMessages(source: string): readonly string[] {
  if (charCount(source) > DIAGRAM_SOURCE_MAX_LENGTH) {
    return [`diagrama com ${String(charCount(source))} caracteres; o máximo é ${String(DIAGRAM_SOURCE_MAX_LENGTH)}`];
  }
  const result = parseDiagram(source);
  if (result.ok) return [];
  return result.errors.map((error) => `linha ${String(error.line)}: ${error.message}`);
}

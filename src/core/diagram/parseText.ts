import type { DiagramError } from './types';

export const ID_RE = /^[a-z][a-z0-9-]*$/;
export const DIRECTIVE_RE = /^([\p{L}_-]+)\s*:\s*(.*)$/u;
export const NODE_RE = /^(\S+)\s+"([^"]*)"\s*(?:\/\s*(.*))?$/;

export interface SourceLine {
  readonly number: number;
  readonly text: string;
  readonly indent: string;
}

function stripComment(line: string): string {
  const chars = [...line];
  let kept = '';
  let quoted = false;
  for (const [index, char] of chars.entries()) {
    if (char === '\\' && chars[index + 1] === '#') continue;
    const escaped = chars[index - 1] === '\\';
    if (char === '"') quoted = !quoted;
    if (char === '#' && !quoted && !escaped) return kept;
    kept += char;
  }
  return kept;
}

export function sourceLines(source: string): readonly SourceLine[] {
  return source
    .split(/\r?\n/)
    .map((raw, index) => {
      const kept = stripComment(raw);
      return { number: index + 1, text: kept.trim(), indent: /^\s*/.exec(kept)?.[0] ?? '' };
    })
    .filter((line) => line.text !== '');
}

export function hasOddQuotes(line: string): boolean {
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

export function closest(word: string, candidates: readonly string[]): string | null {
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

export function sortedErrors(errors: readonly DiagramError[]): readonly DiagramError[] {
  return [...errors].sort((a, b) => a.line - b.line);
}

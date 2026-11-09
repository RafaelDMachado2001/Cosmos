import { describe, expect, it } from 'vitest';

import { en } from './en';
import { pt } from './pt';

function leaves(node: unknown, path: string[] = []): [string, string][] {
  if (typeof node === 'string') return [[path.join('.'), node]];
  if (typeof node !== 'object' || node === null) return [];
  return Object.entries(node).flatMap(([key, value]) => leaves(value, [...path, key]));
}

function slots(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1] ?? '').sort();
}

describe('dicionários', () => {
  it('cada texto com {chave} tem as mesmas chaves nos dois idiomas', () => {
    const english = new Map(leaves(en));
    const mismatched = leaves(pt).filter(
      ([path, text]) => slots(text).join() !== slots(english.get(path) ?? '').join(),
    );
    expect(mismatched).toEqual([]);
  });
});

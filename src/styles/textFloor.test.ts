import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const FLOOR_PX = 11;

function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return cssFiles(path);
    return entry.name.endsWith('.css') ? [path] : [];
  });
}

describe('piso de texto', () => {
  it('nenhum font-size em px abaixo de 11 no site', () => {
    const offenders: string[] = [];
    for (const file of [...cssFiles('src/components'), ...cssFiles('src/styles')]) {
      for (const [index, line] of readFileSync(file, 'utf8').split('\n').entries()) {
        const declaration = /font-size:\s*([^;]+);/.exec(line);
        if (!declaration?.[1]) continue;
        const value = declaration[1].replace(/var\(--text-min\)\s*\+\s*[0-9.]+px/g, '');
        const sizes = [...value.matchAll(/([0-9.]+)px/g)].map((m) => Number(m[1]));
        if (sizes.some((size) => size < FLOOR_PX)) offenders.push(`${file}:${index + 1}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('o piso sobe para 12px no celular', () => {
    const tokens = readFileSync('src/styles/tokens.css', 'utf8');
    expect(tokens).toMatch(/--text-min:\s*11px;/);
    expect(tokens).toMatch(/@media \(max-width: 640px\)\s*{\s*:root\s*{\s*--text-min:\s*12px;/);
  });
});

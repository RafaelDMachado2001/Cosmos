import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

/*
 * Os cabeçalhos que a Vercel põe no site. Nenhum outro teste os vê: o e2e roda
 * contra o Nginx do compose, que tem a configuração dele.
 */

interface HeaderRule {
  readonly source: string;
  readonly headers: readonly { readonly key: string; readonly value: string }[];
}

const config = JSON.parse(readFileSync('vercel.json', 'utf8')) as { headers: HeaderRule[] };

/** O valor de um cabeçalho para um caminho: a última regra que casa vence, como na Vercel. */
function headerFor(path: string, key: string): string | undefined {
  let value: string | undefined;
  for (const rule of config.headers) {
    if (!new RegExp(`^${rule.source}$`).test(path)) continue;
    const found = rule.headers.find((header) => header.key.toLowerCase() === key.toLowerCase());
    if (found) value = found.value;
  }
  return value;
}

describe('vercel.json', () => {
  it('o HTML fica uma hora na borda e é revalidado em segundo plano', () => {
    // Antes era no-cache: cada visita ia à origem (x-vercel-cache: MISS, TTFB
    // de 3s). Cada deploy é um cache novo, então publicar não espera a hora.
    for (const path of ['/pt', '/en/publications/code-review-sem-atrito', '/sitemap.xml']) {
      expect(headerFor(path, 'Cache-Control'), path).toBe(
        'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
      );
    }
  });

  it('os arquivos com hash no nome são imutáveis', () => {
    expect(headerFor('/assets/index-abc123.js', 'Cache-Control')).toBe(
      'public, max-age=31536000, immutable',
    );
    expect(headerFor('/og/abc.png', 'Cache-Control')).toBe('public, max-age=31536000, immutable');
  });
});

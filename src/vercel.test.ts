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

  it('o HTML não libera CORS para qualquer origem; o cartão e o RSS sim', () => {
    // O padrão da Vercel é `*` em todo arquivo estático; o HTML não precisa.
    expect(headerFor('/pt', 'Access-Control-Allow-Origin')).toBe('https://cosmos.rdmlabs.com.br');
    expect(headerFor('/data/publications.pt.json', 'Access-Control-Allow-Origin')).toBe(
      'https://cosmos.rdmlabs.com.br',
    );
    expect(headerFor('/og/abc.png', 'Access-Control-Allow-Origin')).toBe('*');
    expect(headerFor('/en/rss.xml', 'Access-Control-Allow-Origin')).toBe('*');
  });

  it('isola a janela e restringe imagens à origem e ao host de mídia', () => {
    expect(headerFor('/pt', 'Cross-Origin-Opener-Policy')).toBe('same-origin');
    const csp = headerFor('/pt', 'Content-Security-Policy') ?? '';
    expect(csp).toContain("img-src 'self' data: https://media.rdmlabs.com.br;");
    expect(csp).not.toMatch(/img-src[^;]*https:(;| )/);
    expect(csp).toContain("script-src 'self';");
  });

  it('HSTS de dois anos com subdomínios, sem preload', () => {
    // Preload fica de fora por decisão: sair da lista leva meses.
    expect(headerFor('/pt', 'Strict-Transport-Security')).toBe(
      'max-age=63072000; includeSubDomains',
    );
  });
});

describe('security.txt', () => {
  const text = readFileSync('public/.well-known/security.txt', 'utf8');

  it('tem contato, validade futura e o endereço canônico (RFC 9116)', () => {
    expect(text).toMatch(/^Contact: https:\/\//m);
    const expires = /^Expires: (.+)$/m.exec(text)?.[1] ?? '';
    expect(Date.parse(expires)).toBeGreaterThan(Date.now());
    expect(text).toContain('Canonical: https://cosmos.rdmlabs.com.br/.well-known/security.txt');
  });
});

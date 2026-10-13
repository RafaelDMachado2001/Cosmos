import { describe, expect, it } from 'vitest';

import { stalePages } from './prune';

describe('poda do que o acervo nao contem mais', () => {
  it('marca para remocao o que existe no disco e nao foi gravado', () => {
    const written = new Set(['pt/publicacoes/vivo/index.html']);
    const existing = ['pt/publicacoes/vivo/index.html', 'pt/publicacoes/morto/index.html'];

    expect(stalePages(existing, written)).toEqual(['pt/publicacoes/morto/index.html']);
  });

  it('nao remove nada quando o disco e o acervo coincidem', () => {
    const written = new Set(['pt/publicacoes/a/index.html', 'en/publications/a/index.html']);
    const existing = ['pt/publicacoes/a/index.html', 'en/publications/a/index.html'];

    expect(stalePages(existing, written)).toEqual([]);
  });

  it('nao se confunde com um acervo vazio: tudo o que esta no disco sai', () => {
    const existing = ['pt/publicacoes/a/index.html'];

    expect(stalePages(existing, new Set())).toEqual(['pt/publicacoes/a/index.html']);
  });
});

import { describe, expect, it } from 'vitest';

import { makeSyntheticPublications } from '../data/synthetic';
import { connectors, resolveBand, visibleRange } from './geometry';
import { placeStars } from './timeline';

/**
 * Orçamento folgado de propósito.
 *
 * Não e benchmark: e trava contra regressão de ordem de grandeza, do tipo que a
 * busca linear em App.tsx era. Número apertado aqui vira teste intermitente em
 * CI compartilhado.
 */
function millis(work: () => void): number {
  const start = performance.now();
  work();
  return performance.now() - start;
}

const BAND = resolveBand({ width: 1920, height: 1080, headerPx: 64, rulerPx: 58 });

describe.each([500, 1000])('acervo de %i publicacoes', (total) => {
  const publications = makeSyntheticPublications({ count: total, seed: 1 });

  it('coloca as estrelas dentro do orçamento', () => {
    expect(millis(() => placeStars(publications))).toBeLessThan(150);
  });

  it('calcula conectores dentro do orçamento', () => {
    const stars = placeStars(publications);
    expect(millis(() => connectors(stars, BAND))).toBeLessThan(150);
  });

  it('calcula a janela visível dentro do orçamento', () => {
    const xs = placeStars(publications).map((star) => star.x);
    expect(millis(() => visibleRange(xs, 0, 1920, 1920 * 1.5))).toBeLessThan(50);
  });

  it('não perde nenhuma publicação pelo caminho', () => {
    expect(placeStars(publications)).toHaveLength(total);
  });
});

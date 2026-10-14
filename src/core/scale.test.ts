import { describe, expect, it } from 'vitest';

import { makeSyntheticPublications } from '../data/synthetic';
import { connectors, resolveBand, visibleRange } from './geometry';
import { placeStars } from './timeline';

/**
 * Orcamento folgado de proposito.
 *
 * Nao e benchmark: e trava contra regressao de ordem de grandeza, do tipo que a
 * busca linear em App.tsx era. Numero apertado aqui vira teste intermitente em
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

  it('coloca as estrelas dentro do orcamento', () => {
    expect(millis(() => placeStars(publications))).toBeLessThan(150);
  });

  it('calcula conectores dentro do orcamento', () => {
    const stars = placeStars(publications);
    expect(millis(() => connectors(stars, BAND))).toBeLessThan(150);
  });

  it('calcula a janela visivel dentro do orcamento', () => {
    const xs = placeStars(publications).map((star) => star.x);
    expect(millis(() => visibleRange(xs, 0, 1920, 1920 * 1.5))).toBeLessThan(50);
  });

  it('nao perde nenhuma publicacao pelo caminho', () => {
    expect(placeStars(publications)).toHaveLength(total);
  });
});

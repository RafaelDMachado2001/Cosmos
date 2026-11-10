import { describe, expect, it } from 'vitest';

import { blurFilter, snapNear, snapToPixel } from './crisp';

describe('snapNear', () => {
  it('chega exatamente ao alvo quando o amortecimento já está perto', () => {
    expect(snapNear(1e-9, 0)).toBe(0);
    expect(snapNear(0.9996, 1)).toBe(1);
  });

  it('não mexe no valor em movimento', () => {
    expect(snapNear(0.2, 0)).toBe(0.2);
  });
});

describe('snapToPixel', () => {
  it('alinha ao pixel do aparelho', () => {
    expect(snapToPixel(10.3, 1)).toBe(10);
    expect(snapToPixel(10.3, 2)).toBe(10.5);
    expect(snapToPixel(-10.2, 3)).toBeCloseTo(-10.333, 3);
  });

  it('nunca devolve -0 nem quebra com razão inválida', () => {
    expect(Object.is(snapToPixel(-0.1, 1), 0)).toBe(true);
    expect(snapToPixel(4.6, 0)).toBe(5);
    expect(snapToPixel(4.6, Number.NaN)).toBe(5);
  });
});

describe('blurFilter', () => {
  it('desliga o filtro em vez de escrever blur(0px)', () => {
    expect(blurFilter(0)).toBe('none');
    expect(blurFilter(1e-7)).toBe('none');
    expect(blurFilter(1.5)).toBe('blur(1.5px)');
  });
});

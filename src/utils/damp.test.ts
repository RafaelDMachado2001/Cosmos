import { describe, expect, it } from 'vitest';

import { damp } from './damp';

describe('damp', () => {
  it('não move nada quando delta é zero', () => {
    expect(damp(0, 1, 4, 0)).toBe(0);
  });

  it('caminha na direção do alvo', () => {
    const next = damp(0, 1, 4, 1 / 60);
    expect(next).toBeGreaterThan(0);
    expect(next).toBeLessThan(1);
  });

  it('nunca passa do alvo, mesmo com delta absurdo', () => {
    expect(damp(0, 1, 4, 10)).toBeLessThanOrEqual(1);
    expect(damp(1, 0, 4, 10)).toBeGreaterThanOrEqual(0);
  });

  it('converge para o alvo com o tempo', () => {
    let value = 0;
    for (let step = 0; step < 300; step += 1) value = damp(value, 1, 4, 1 / 60);
    expect(value).toBeCloseTo(1, 3);
  });

  it('funciona descendo, não só subindo', () => {
    expect(damp(1, 0, 4, 1 / 60)).toBeLessThan(1);
  });
});

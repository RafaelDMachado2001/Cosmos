import { describe, expect, it } from 'vitest';

import { DEFAULT_APPEARANCE, NEBULA_MAX, parseAppearance, resolveAppearance } from './appearance';

describe('aparência', () => {
  it('nulo herda o padrão global', () => {
    expect(resolveAppearance(null)).toEqual({ nebula: 0.3, motion: true });
    expect(resolveAppearance(undefined)).toBe(DEFAULT_APPEARANCE);
  });

  it('um valor gravado sobrescreve o padrão inteiro', () => {
    expect(resolveAppearance({ nebula: 1, motion: false })).toEqual({ nebula: 1, motion: false });
  });

  it('a intensidade fica entre 0 e o teto', () => {
    expect(parseAppearance({ nebula: 9, motion: true })?.nebula).toBe(NEBULA_MAX);
    expect(parseAppearance({ nebula: -1, motion: true })?.nebula).toBe(0);
  });

  it('forma inesperada herda, nunca lança', () => {
    expect(parseAppearance(null)).toBeNull();
    expect(parseAppearance('forte')).toBeNull();
    expect(parseAppearance({ nebula: '0.5', motion: true })).toBeNull();
    expect(parseAppearance({ nebula: Number.NaN, motion: true })).toBeNull();
    expect(parseAppearance({ nebula: 0.5 })).toBeNull();
  });
});

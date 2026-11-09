import { describe, expect, it } from 'vitest';

import { countLabel, fill, monthLabel, monthYearLabel } from './format';

const SET_2025 = Date.parse('2025-09-12T12:00:00.000Z');
const JAN_2026 = Date.parse('2026-01-20T12:00:00.000Z');

describe('monthYearLabel', () => {
  it('abrevia o mês e o ano, em caixa alta', () => {
    expect(monthYearLabel(SET_2025, 'pt')).toBe('SET 2025');
    expect(monthYearLabel(SET_2025, 'en')).toBe('SEPT 2025');
  });

  it('não deixa a preposição que o português insere entre mês e ano', () => {
    expect(monthYearLabel(JAN_2026, 'pt')).toBe('JAN 2026');
  });

  it('não deixa ponto de abreviação', () => {
    for (const locale of ['pt', 'en'] as const) {
      expect(monthYearLabel(SET_2025, locale)).not.toContain('.');
    }
  });

  it('lê a data em UTC, não no fuso de quem roda', () => {
    const virada = Date.parse('2025-03-01T00:30:00.000Z');
    expect(monthYearLabel(virada, 'pt')).toBe('MAR 2025');
  });
});

describe('monthLabel', () => {
  it('só o mês, abreviado, em caixa alta e sem ponto', () => {
    expect(monthLabel(SET_2025, 'pt')).toBe('SET');
    expect(monthLabel(SET_2025, 'en')).toBe('SEPT');
    expect(monthLabel(Date.parse('2025-02-01T00:30:00.000Z'), 'pt')).toBe('FEV');
  });
});

describe('fill', () => {
  it('troca cada chave pelo valor', () => {
    expect(fill('{n} acenderam', { n: 13 })).toBe('13 acenderam');
    expect(fill('digite @{handle}', { handle: 'ana_r' })).toBe('digite @ana_r');
  });

  it('deixa intacta a chave sem valor', () => {
    expect(fill('{n} de {max}', { n: 1 })).toBe('1 de {max}');
  });
});

describe('countLabel', () => {
  it('separa milhar como cada idioma escreve', () => {
    expect(countLabel(2000, 'pt')).toBe('2.000');
    expect(countLabel(2000, 'en')).toBe('2,000');
  });
});

import { describe, expect, it } from 'vitest';

import { monthLabel, monthYearLabel, shortTitle } from './format';

const SET_2025 = Date.parse('2025-09-12T12:00:00.000Z');
const JAN_2026 = Date.parse('2026-01-20T12:00:00.000Z');

describe('monthYearLabel', () => {
  it('abrevia o mês e o ano, em caixa alta', () => {
    expect(monthYearLabel(SET_2025, 'pt')).toBe('SET 2025');
    // "Sept" é a abreviação do en-GB, que é o locale escolhido para datas.
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
    // 1º de março em UTC; 28 de fevereiro em qualquer fuso a oeste de Greenwich.
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

describe('shortTitle', () => {
  it('deixa intacto o título que cabe', () => {
    expect(shortTitle('Fundamentos de índices no PostgreSQL')).toBe(
      'Fundamentos de índices no PostgreSQL',
    );
  });

  it('corta na última palavra inteira e fecha com reticências', () => {
    const short = shortTitle('Arquitetura e Orquestração de LLMs em sistemas de produção reais');
    expect(short).toBe('Arquitetura e Orquestração de LLMs em…');
    expect(short.length).toBeLessThanOrEqual(41);
  });

  it('corta no limite quando não há espaço razoável para quebrar', () => {
    const short = shortTitle('Supercalifragilisticexpialidocious-e-outras-palavras-longas');
    expect(short).toBe('Supercalifragilisticexpialidocious-e-out…');
  });

  it('não deixa espaço nem pontuação antes das reticências', () => {
    expect(shortTitle('Um título qualquer, com vírgula, que passa do limite de largura')).not.toMatch(
      /[\s,;:—-]…$/,
    );
  });
});

import { describe, expect, it } from 'vitest';

import { describeSpectrum } from './describe';
import { REFERENCE_SPECTRUM } from './fixture';
import { parseDiagram } from './parse';
import { spectrumZoneView } from './spectrum';
import type { DiagramError, SpectrumDiagram } from './types';

function spectrum(source: string): SpectrumDiagram {
  const result = parseDiagram(source);
  if (!result.ok || result.diagram.kind !== 'spectrum') throw new Error(JSON.stringify(result));
  return result.diagram;
}

function errors(source: string): readonly DiagramError[] {
  const result = parseDiagram(source);
  if (result.ok) throw new Error('esperava erro');
  return result.errors;
}

const ZONES = ['zone "A" 0-50', 'zone "B" 50-100'];
const LANES = ['lane "X" 0-60', 'lane "Y" 40-100'];
const source = (...lines: readonly string[]): string => ['spectrum s', ...lines].join('\n');

describe('parseDiagram: espectro', () => {
  it('lê o exemplo de referência', () => {
    const diagram = spectrum(REFERENCE_SPECTRUM);
    expect(diagram.axis).toEqual({ from: 'água encontra o pó', to: 'extração completa' });
    expect(diagram.zones.map((zone) => [zone.from, zone.to])).toEqual([[0, 38], [38, 66], [66, 100]]);
    expect(diagram.zones[1]).toMatchObject({ taste: 'Doce, equilibrado', next: 'Não mexa. Anote a receita' });
    expect(diagram.lanes[1]).toMatchObject({ label: 'Doces', from: 24, to: 74 });
  });

  it('taste e next são opcionais', () => {
    expect(spectrum(source(...ZONES, ...LANES)).zones[0]).toMatchObject({ taste: null, next: null });
  });

  it.each([
    ['zona com buraco', [...['zone "A" 0-40', 'zone "B" 50-100'], ...LANES], 'deveria começar em 40'],
    ['zonas que não chegam a 100', [...['zone "A" 0-40', 'zone "B" 40-90'], ...LANES], 'precisa chegar a 100'],
    ['uma zona só', ['zone "A" 0-100', ...LANES], '1 zonas'],
    ['uma faixa só', [...ZONES, 'lane "X" 0-60'], '1 faixas'],
    ['faixa invertida', [...ZONES, 'lane "X" 60-10', 'lane "Y" 0-10'], 'faixa 60-10 inválida'],
    ['faixa além de 100', [...ZONES, 'lane "X" 60-120', 'lane "Y" 0-10'], 'faixa 60-120 inválida'],
    ['zona repetida', [...ZONES, 'zone "A" 50-100', ...LANES], 'repetido'],
    ['taste fora de zona', ['taste: x', ...ZONES, ...LANES], 'fora de uma zona'],
    ['diretiva errada', ['tast: x', ...ZONES, ...LANES], 'Use "taste"'],
    ['eixo incompleto', ['axis: só início', ...ZONES, ...LANES], 'eixo incompleto'],
    ['linha solta', [...ZONES, ...LANES, 'a -> b'], 'linha inválida'],
  ])('%s', (_name, lines, message) => {
    expect(errors(source(...lines)).map((error) => error.message).join('\n')).toContain(message);
  });

  it('erro aponta a linha', () => {
    expect(errors(source('zone "A" 0-40', 'zone "B" 50-100', ...LANES))[0]?.line).toBe(3);
  });
});

describe('spectrumZoneView', () => {
  it('marca o meio da zona e preenche cada faixa até ali', () => {
    const diagram = spectrum(REFERENCE_SPECTRUM);
    const [first, middle, last] = diagram.zones.map((zone) => spectrumZoneView(diagram, zone));
    expect(first).toEqual({ marker: 19, fills: [45.2, 0, 0] });
    expect(middle).toEqual({ marker: 52, fills: [100, 56, 0] });
    expect(last).toEqual({ marker: 83, fills: [100, 100, 59.5] });
  });
});

describe('describeSpectrum', () => {
  it('descreve eixo, zonas e faixas', () => {
    const text = describeSpectrum(spectrum(source('axis: a -> b', 'zone "A" 0-50', 'taste: x', 'next: y', 'zone "B" 50-100', ...LANES)));
    expect(text).toBe('a para b. A, de 0% a 50%: x: y. B, de 50% a 100%. X, de 0% a 60%. Y, de 40% a 100%.');
  });
});

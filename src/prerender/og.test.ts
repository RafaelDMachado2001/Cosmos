import { describe, expect, it } from 'vitest';

import type { OgCard } from '../core/og';
import { ogPng, ogSvg } from './og';

const CARD: OgCard = {
  locale: 'pt',
  title: 'Code review sem atrito',
  kicker: 'Artigo técnico',
  category: 'artigo',
  date: '2025-09-09',
};

describe('cartao de Open Graph', () => {
  it('pinta com os tokens reais: o fundo do site e a cor da categoria', async () => {
    const svg = await ogSvg(CARD);
    expect(svg).toContain('#05060b');
    expect(svg).toContain('#6e7bff');
  });

  it('sem categoria, o acento e o roxo do site', async () => {
    const svg = await ogSvg({ locale: 'pt', title: 'Entre no meu universo', kicker: 'RDM Labs' });
    expect(svg).toContain('#8c6bff');
  });

  it('sai como PNG de 1200x630', async () => {
    const png = await ogPng(CARD);
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    // IHDR: largura e altura em big-endian logo depois do cabecalho do chunk.
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
  });
});

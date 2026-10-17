import { describe, expect, it } from 'vitest';

import {
  ATMOSPHERE,
  atmosphereIntensity,
  cullSky,
  emptyCull,
  generateSky,
  giantYearX,
  yearLayerTransform,
} from './atmosphere';
import type { Nebula, Rgb } from './atmosphere';
import { placeStars } from './timeline';
import type { Category, PublicationInput } from './types';

const COLORS: Record<Category, Rgb> = {
  artigo: [0.43, 0.48, 1],
  projeto: [1, 0.54, 0.24],
  estudo: [0.29, 0.87, 0.61],
  rotina: [1, 0.3, 0.49],
};
const colorOf = (category: Category): Rgb => COLORS[category];

function item(slug: string, publishedAt: string, category: Category = 'artigo'): PublicationInput {
  return { slug, publishedAt, category };
}

const ACERVO: readonly PublicationInput[] = [
  item('a', '2024-02-10T12:00:00Z', 'artigo'),
  item('b', '2024-06-01T12:00:00Z', 'projeto'),
  item('c', '2024-11-20T12:00:00Z', 'estudo'),
  item('d', '2025-04-03T12:00:00Z', 'rotina'),
  item('e', '2025-09-15T12:00:00Z', 'artigo'),
  item('f', '2026-05-30T12:00:00Z', 'estudo'),
];

describe('generateSky', () => {
  it('é determinístico: mesma lista, mesmo céu', () => {
    const one = generateSky(placeStars(ACERVO), colorOf);
    const two = generateSky(placeStars([...ACERVO].reverse()), colorOf);
    expect(two).toEqual(one);
    expect(one.nebulae.length).toBeGreaterThan(0);
  });

  it('não tem céu sem estrelas', () => {
    expect(generateSky([], colorOf)).toEqual({ nebulae: [], galaxies: [] });
  });

  it('uma única publicação já gera céu, sem lançar', () => {
    const sky = generateSky(placeStars([item('solo', '2024-02-10T12:00:00Z')]), colorOf);
    expect(sky.nebulae.length).toBeGreaterThan(0);
    for (const nebula of sky.nebulae) {
      expect(Number.isFinite(nebula.px)).toBe(true);
    }
  });

  it('publicar não move o que já estava no céu: só estende a ponta', () => {
    const before = generateSky(placeStars(ACERVO), colorOf);
    const after = generateSky(
      placeStars([...ACERVO, item('g', '2027-10-01T12:00:00Z', 'projeto')]),
      colorOf,
    );

    // A cor pode mudar perto da estrela nova; a posição e a forma, nunca.
    const strip = (list: readonly Nebula[]) =>
      list.map((nebula) => [nebula.px, nebula.y01, nebula.radius, nebula.weight]);
    expect(strip(after.nebulae).slice(0, before.nebulae.length)).toEqual(strip(before.nebulae));
    expect(after.galaxies.slice(0, before.galaxies.length)).toEqual(before.galaxies);
    expect(after.nebulae.length).toBeGreaterThan(before.nebulae.length);
  });

  it('respeita as faixas do handoff', () => {
    const many = Array.from({ length: 80 }, (_, index) =>
      item(`p${index}`, new Date(Date.UTC(2024, 0, 1) + index * 9 * 86400000).toISOString()),
    );
    const sky = generateSky(placeStars(many), colorOf);

    for (const nebula of sky.nebulae) {
      expect(nebula.y01).toBeGreaterThanOrEqual(0.22);
      expect(nebula.y01).toBeLessThanOrEqual(0.78);
      expect(nebula.radius).toBeGreaterThanOrEqual(220);
      expect(nebula.radius).toBeLessThanOrEqual(500);
      expect(nebula.weight).toBeGreaterThanOrEqual(0.3);
      expect(nebula.weight).toBeLessThanOrEqual(0.75);
    }
    for (const galaxy of sky.galaxies) {
      expect(galaxy.size).toBeGreaterThanOrEqual(70);
      expect(galaxy.size).toBeLessThanOrEqual(160);
      expect(galaxy.squash).toBeGreaterThanOrEqual(0.32);
      expect(galaxy.squash).toBeLessThanOrEqual(0.72);
      expect(galaxy.brightness).toBeGreaterThanOrEqual(0.3);
      expect(galaxy.brightness).toBeLessThanOrEqual(0.55);
    }
    // Galáxias são raras: no mínimo 2400px de linha do tempo entre elas.
    const galaxyX = sky.galaxies.map((galaxy) => galaxy.px / ATMOSPHERE.galaxyParallax);
    for (let i = 1; i < galaxyX.length; i += 1) {
      expect((galaxyX[i] ?? 0) - (galaxyX[i - 1] ?? 0)).toBeGreaterThan(2400);
    }
    expect(sky.galaxies.length).toBeGreaterThan(0);
  });

  it('tinge cada nebulosa com a categoria da publicação mais próxima', () => {
    // Uma categoria só: toda nebulosa fica entre o roxo base e aquela cor.
    const sky = generateSky(
      placeStars(ACERVO.map((entry) => ({ ...entry, category: 'projeto' as const }))),
      colorOf,
    );
    const [baseR] = ATMOSPHERE.basePurple;
    for (const nebula of sky.nebulae) {
      const k = (nebula.color[0] - baseR) / (COLORS.projeto[0] - baseR);
      expect(k).toBeGreaterThanOrEqual(0.32 - 1e-9);
      expect(k).toBeLessThanOrEqual(0.52 + 1e-9);
    }
  });
});

describe('cullSky', () => {
  const sky = generateSky(
    placeStars(
      Array.from({ length: 120 }, (_, index) =>
        item(`p${index}`, new Date(Date.UTC(2024, 0, 1) + index * 7 * 86400000).toISOString()),
      ),
    ),
    colorOf,
  );

  it('manda ao shader só o que está na tela, com margem', () => {
    const out = emptyCull();
    cullSky(sky, 2000, 1280, 8, out);

    expect(out.nebulae.length).toBeGreaterThan(0);
    for (const nebula of out.nebulae) {
      const screenX = nebula.px - 2000 * ATMOSPHERE.nebulaParallax;
      expect(screenX).toBeGreaterThanOrEqual(-nebula.radius * 2.2);
      expect(screenX).toBeLessThanOrEqual(1280 + nebula.radius * 2.2);
    }
  });

  it('nunca passa do teto: o custo do shader é constante', () => {
    const out = emptyCull();
    // Uma tela absurda veria tudo; o teto ainda vale.
    cullSky(sky, 0, 100000, 5, out);
    expect(out.nebulae.length).toBe(5);
    expect(out.galaxies.length).toBeLessThanOrEqual(ATMOSPHERE.maxGalaxies);
  });

  it('reaproveita as listas de saída a cada quadro', () => {
    const out = emptyCull();
    const { nebulae, galaxies } = out;
    cullSky(sky, 0, 1280, 8, out);
    cullSky(sky, 4000, 1280, 8, out);
    expect(out.nebulae).toBe(nebulae);
    expect(out.galaxies).toBe(galaxies);
  });
});

describe('atmosphereIntensity', () => {
  it('some na entrada, acompanha a travessia e cai a 45% com o artigo aberto', () => {
    expect(atmosphereIntensity(0, 0)).toBe(0);
    expect(atmosphereIntensity(0.5, 0)).toBe(0.5);
    expect(atmosphereIntensity(1, 1)).toBeCloseTo(0.45);
  });
});

describe('anos gigantes', () => {
  it('ficam a 75% da posição do ano e andam a 75% do pan', () => {
    // Um numeral em x * 0.75 deslocado por -pan * 0.75 cai em tela em
    // (x - pan) * 0.75: atrás da estrela, mais devagar que ela.
    const x = giantYearX(4000);
    const { x: offset, scale } = yearLayerTransform(1000, 0, 0, 0);
    expect(x + offset).toBe((4000 - 1000) * 0.75);
    expect(scale).toBe(1);
  });

  it('seguem só parte da parallax, do avanço e do zoom da constelação', () => {
    expect(yearLayerTransform(0, 10, 0, 0).x).toBeCloseTo(4);
    expect(yearLayerTransform(0, 0, 100, 0).x).toBeCloseTo(-60);
    expect(yearLayerTransform(0, 0, 0, 1).scale).toBeCloseTo(1.4);
  });
});

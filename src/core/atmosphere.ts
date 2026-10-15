/**
 * O céu procedural por trás da constelação: nebulosas e galáxias.
 *
 * Gerado uma vez por acervo e enviado ao shader de fundo por culling a cada
 * quadro. Nada aqui é desenhado à mão — tudo vem de uma sequência
 * determinística.
 *
 * **Divergência deliberada do handoff.** Lá a semente é o hash dos ids, e uma
 * publicação nova recompõe o céu inteiro. Aqui a semente é fixa e a sequência
 * avança pela linha do tempo, então o céu já gerado é um prefixo do próximo:
 * publicar só estende a ponta direita e retinge as nebulosas vizinhas da
 * estrela nova. É a mesma garantia que `placeStars` dá às estrelas — publicar
 * não move nada que já estava lá — e continua valendo "mesma lista, mesmo céu".
 *
 * Módulo puro: sem DOM, sem React, sem Three.
 */

import { fnv1a32 } from './hash';
import { mulberry32 } from './random';
import { strandExtent } from './geometry';
import type { PlacedStar } from './timeline';
import type { Category } from './types';

export type Rgb = readonly [number, number, number];

export interface Nebula {
  /** x no espaço da camada, já multiplicado pelo fator de parallax. */
  readonly px: number;
  /** Altura em fração da viewport. */
  readonly y01: number;
  readonly radius: number;
  readonly weight: number;
  readonly color: Rgb;
}

export interface Galaxy {
  /** x no espaço da camada, já multiplicado pelo fator de parallax. */
  readonly px: number;
  readonly y01: number;
  readonly size: number;
  /** Achatamento do disco, aplicado no eixo y antes da rotação. */
  readonly squash: number;
  readonly angle: number;
  readonly brightness: number;
}

export interface Sky {
  readonly nebulae: readonly Nebula[];
  readonly galaxies: readonly Galaxy[];
}

export const ATMOSPHERE = {
  /** Fixa de propósito: ver a nota do módulo. */
  seed: fnv1a32('rdm-cosmos/atmosfera'),
  /** Onde a sequência começa, no espaço da linha do tempo. */
  startX: 120,
  /**
   * Quanto o céu passa da última estrela. O handoff usa 600; aqui é maior
   * porque a camada anda mais devagar que o pan, e numa tela larga a ponta
   * direita do céu ficaria à vista antes da última estrela sair dela.
   */
  tailPx: 3000,
  nebulaChance: 0.58,
  galaxyMinGapPx: 2400,
  stepMinPx: 460,
  stepRangePx: 560,
  nebulaParallax: 0.6,
  galaxyParallax: 0.3,
  basePurple: [0.4, 0.27, 0.92] as Rgb,
  /** Quanto da cor da categoria entra na nebulosa: 32% a 52%. */
  tintMin: 0.32,
  tintRange: 0.2,
  maxNebulae: { wide: 8, narrow: 5 },
  maxGalaxies: 3,
} as const;

/** Estrela mais próxima de x. `stars` vem ordenado por x de `placeStars`. */
function nearest(stars: readonly PlacedStar[], x: number): PlacedStar | undefined {
  let low = 0;
  let high = stars.length - 1;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if ((stars[mid]?.x ?? 0) < x) low = mid + 1;
    else high = mid;
  }
  const after = stars[low];
  const before = stars[low - 1];
  if (!before) return after;
  if (!after) return before;
  return x - before.x <= after.x - x ? before : after;
}

function mix(base: Rgb, tint: Rgb, k: number): Rgb {
  return [
    base[0] * (1 - k) + tint[0] * k,
    base[1] * (1 - k) + tint[1] * k,
    base[2] * (1 - k) + tint[2] * k,
  ];
}

/**
 * Percorre a linha do tempo em passos de 460–1020px. Em cada parada: nebulosa
 * (58%), galáxia (se a última estiver a mais de 2400px) ou vazio, que é o
 * respiro entre elas.
 */
export function generateSky(
  stars: readonly PlacedStar[],
  colorOf: (category: Category) => Rgb,
  config = ATMOSPHERE,
): Sky {
  if (stars.length === 0) return { nebulae: [], galaxies: [] };

  const random = mulberry32(config.seed);
  const endX = strandExtent(stars).maxX + config.tailPx;
  const nebulae: Nebula[] = [];
  const galaxies: Galaxy[] = [];

  let lastGalaxyX = Number.NEGATIVE_INFINITY;
  for (let x: number = config.startX; x < endX; ) {
    const roll = random();
    if (roll < config.nebulaChance) {
      const star = nearest(stars, x);
      const tint = star ? colorOf(star.category) : config.basePurple;
      const k = config.tintMin + random() * config.tintRange;
      nebulae.push({
        px: x * config.nebulaParallax,
        y01: 0.22 + random() * 0.56,
        radius: 220 + random() * 280,
        weight: 0.3 + random() * 0.45,
        color: mix(config.basePurple, tint, k),
      });
    } else if (x - lastGalaxyX > config.galaxyMinGapPx) {
      galaxies.push({
        px: x * config.galaxyParallax,
        y01: 0.18 + random() * 0.62,
        size: 70 + random() * 90,
        squash: 0.32 + random() * 0.4,
        angle: random() * Math.PI,
        brightness: 0.3 + random() * 0.25,
      });
      lastGalaxyX = x;
    }
    x += config.stepMinPx + random() * config.stepRangePx;
  }

  return { nebulae, galaxies };
}

/**
 * Quanto do céu aparece. Acompanha a revelação do cosmos — invisível na
 * entrada, sobe com a travessia — e cai a 45% quando um artigo se abre.
 */
export function atmosphereIntensity(reveal: number, zoom: number): number {
  return reveal * (1 - zoom * 0.55);
}

/** Saída do culling. Reaproveitada a cada quadro para não alocar no laço. */
export interface SkyCull {
  readonly nebulae: Nebula[];
  readonly galaxies: Galaxy[];
}

export function emptyCull(): SkyCull {
  return { nebulae: [], galaxies: [] };
}

/**
 * O que está na tela, com margem, até o teto de cada tipo. O shader recebe
 * arrays de tamanho fixo, então o custo por pixel não cresce com o acervo.
 */
export function cullSky(
  sky: Sky,
  pan: number,
  viewportWidth: number,
  maxNebulae: number,
  out: SkyCull,
  config = ATMOSPHERE,
): void {
  out.nebulae.length = 0;
  out.galaxies.length = 0;

  const nebulaPan = pan * config.nebulaParallax;
  for (const nebula of sky.nebulae) {
    if (out.nebulae.length >= maxNebulae) break;
    const screenX = nebula.px - nebulaPan;
    const margin = nebula.radius * 2.2;
    if (screenX < -margin || screenX > viewportWidth + margin) continue;
    out.nebulae.push(nebula);
  }

  const galaxyPan = pan * config.galaxyParallax;
  for (const galaxy of sky.galaxies) {
    if (out.galaxies.length >= config.maxGalaxies) break;
    const screenX = galaxy.px - galaxyPan;
    const margin = galaxy.size * 4;
    if (screenX < -margin || screenX > viewportWidth + margin) continue;
    out.galaxies.push(galaxy);
  }
}

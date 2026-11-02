import { fnv1a32 } from './hash';
import { mulberry32 } from './random';
import { strandExtent } from './geometry';
import type { PlacedStar } from './timeline';
import type { Category } from './types';

export type Rgb = readonly [number, number, number];

export interface Nebula {
  readonly px: number;
  readonly y01: number;
  readonly radius: number;
  readonly weight: number;
  readonly color: Rgb;
}

export interface Galaxy {
  readonly px: number;
  readonly y01: number;
  readonly size: number;
  readonly squash: number;
  readonly angle: number;
  readonly brightness: number;
}

export interface Sky {
  readonly nebulae: readonly Nebula[];
  readonly galaxies: readonly Galaxy[];
}

export const ATMOSPHERE = {
  seed: fnv1a32('rdm-cosmos/atmosfera'),
  startX: 120,
  tailPx: 3000,
  nebulaChance: 0.58,
  galaxyMinGapPx: 2400,
  stepMinPx: 460,
  stepRangePx: 560,
  nebulaParallax: 0.6,
  galaxyParallax: 0.3,
  basePurple: [0.4, 0.27, 0.92] as Rgb,
  tintMin: 0.32,
  tintRange: 0.2,
  maxNebulae: { wide: 8, narrow: 5 },
  maxGalaxies: 3,
} as const;

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

export function atmosphereIntensity(reveal: number, zoom: number): number {
  return reveal * (1 - zoom * 0.55);
}

export interface SkyCull {
  readonly nebulae: Nebula[];
  readonly galaxies: Galaxy[];
}

export function emptyCull(): SkyCull {
  return { nebulae: [], galaxies: [] };
}

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

export const YEAR_LAYER = {
  parallax: 0.75,
  pointerShare: 0.4,
  pushShare: 0.6,
  zoomGrowth: 0.4,
} as const;

export function giantYearX(timelineX: number): number {
  return timelineX * YEAR_LAYER.parallax;
}

export interface LayerTransform {
  readonly x: number;
  readonly scale: number;
}

export function yearLayerTransform(
  pan: number,
  pointerX: number,
  push: number,
  zoom: number,
): LayerTransform {
  return {
    x: -pan * YEAR_LAYER.parallax + pointerX * YEAR_LAYER.pointerShare - push * YEAR_LAYER.pushShare,
    scale: 1 + zoom * YEAR_LAYER.zoomGrowth,
  };
}

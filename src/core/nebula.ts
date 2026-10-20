/**
 * A nebulosa da tela de leitura: manchas de cor, faixas de poeira e estrelas,
 * desenhadas em HTML por `<Nebula>` com as cores do tema (`--n1`, `--cat`...).
 *
 * Este módulo só decide onde cada coisa fica, a partir de uma semente: a
 * mesma publicação abre sempre com o mesmo céu, no prerender e no cliente,
 * e o React não precisa de estado nenhum para isso.
 *
 * Módulo puro: sem DOM, sem React, sem Three.
 */

import { fnv1a32 } from './hash';
import { mulberry32 } from './random';

export type NebulaVariant = 'tall' | 'wide';

export type NebulaTone = 'cat' | 'n1' | 'n2' | 'n3' | 'warm';

/** Posições e tamanhos em % do contêiner. */
export interface NebulaBlob {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly tone: NebulaTone;
  /** Opacidade antes da intensidade: 0.14 a 0.55. */
  readonly base: number;
  readonly blurPx: number;
  readonly driftSec: number;
  readonly delaySec: number;
}

export interface NebulaDust {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly angleDeg: number;
}

export interface NebulaStar {
  readonly x: number;
  readonly y: number;
  readonly sizePx: number;
  readonly twinkle: boolean;
  readonly delaySec: number;
  /** Estrela com brilho em cruz, maior. */
  readonly sparkle: boolean;
}

export interface NebulaLayout {
  readonly blobs: readonly NebulaBlob[];
  readonly dust: readonly NebulaDust[];
  readonly stars: readonly NebulaStar[];
}

/** Cor quente só numa mancha: é tempero, não base. */
const TONES: readonly NebulaTone[] = ['n1', 'cat', 'n2', 'n3', 'n1', 'n2'];

export function nebulaLayout(seed: string, variant: NebulaVariant): NebulaLayout {
  const random = mulberry32(fnv1a32(`${variant}/${seed}`));
  const between = (min: number, max: number): number => min + random() * (max - min);
  const tall = variant === 'tall';

  const blobCount = 4 + Math.floor(random() * 3);
  const blobs: NebulaBlob[] = [];
  for (let index = 0; index < blobCount; index += 1) {
    const size = between(tall ? 55 : 30, tall ? 95 : 60);
    blobs.push({
      x: between(-15, 85),
      y: between(tall ? -5 : -20, tall ? 85 : 70),
      width: size * (tall ? 1 : 1.2),
      height: size * (tall ? 0.8 : 1.6),
      tone: TONES[index] ?? 'n1',
      base: between(0.14, 0.55),
      blurPx: between(30, 50),
      driftSec: between(22, 40),
      delaySec: -between(0, 20),
    });
  }
  // A mancha quente, pequena e afastada do centro.
  blobs.push({
    x: between(60, 90),
    y: between(tall ? 55 : 10, tall ? 85 : 50),
    width: tall ? 30 : 18,
    height: tall ? 24 : 30,
    tone: 'warm',
    base: between(0.14, 0.3),
    blurPx: 40,
    driftSec: between(22, 40),
    delaySec: -between(0, 20),
  });

  const dustCount = 1 + Math.floor(random() * 2);
  const dust: NebulaDust[] = [];
  for (let index = 0; index < dustCount; index += 1) {
    dust.push({
      x: between(-10, 50),
      y: between(15, 70),
      width: between(70, 110),
      height: between(6, 12),
      angleDeg: between(-18, 18),
    });
  }

  const starCount = 70 + Math.floor(random() * 21);
  const sparkles = 2 + Math.floor(random() * 2);
  const stars: NebulaStar[] = [];
  for (let index = 0; index < starCount; index += 1) {
    const sparkle = index < sparkles;
    stars.push({
      x: between(1, 99),
      y: between(1, 99),
      sizePx: sparkle ? 2 : random() < 0.75 ? 1 : 2,
      twinkle: !sparkle && random() < 0.2,
      delaySec: -between(0, 6),
      sparkle,
    });
  }

  return { blobs, dust, stars };
}

/** Opacidade final de uma mancha: base × intensidade, com teto em 1. */
export function blobOpacity(base: number, intensity: number): number {
  return Math.min(1, Math.max(0, base * intensity));
}

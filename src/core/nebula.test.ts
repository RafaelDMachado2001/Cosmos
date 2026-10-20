import { describe, expect, it } from 'vitest';

import { blobOpacity, nebulaLayout } from './nebula';

describe('nebulaLayout', () => {
  it('mesma semente, mesmo céu; outra semente, outro céu', () => {
    expect(nebulaLayout('a', 'tall')).toEqual(nebulaLayout('a', 'tall'));
    expect(nebulaLayout('a', 'tall')).not.toEqual(nebulaLayout('b', 'tall'));
    expect(nebulaLayout('a', 'tall')).not.toEqual(nebulaLayout('a', 'wide'));
  });

  it('respeita as contagens e faixas do desenho', () => {
    for (const seed of ['a', 'b', 'c', 'code-review-sem-atrito', 'x'.repeat(40)]) {
      for (const variant of ['tall', 'wide'] as const) {
        const { blobs, dust, stars } = nebulaLayout(seed, variant);
        const colored = blobs.filter((blob) => blob.tone !== 'warm');
        expect(colored.length).toBeGreaterThanOrEqual(4);
        expect(colored.length).toBeLessThanOrEqual(6);
        expect(blobs.filter((blob) => blob.tone === 'warm')).toHaveLength(1);
        expect(dust.length).toBeGreaterThanOrEqual(1);
        expect(dust.length).toBeLessThanOrEqual(2);
        expect(stars.length).toBeGreaterThanOrEqual(70);
        expect(stars.length).toBeLessThanOrEqual(90);
        const sparkles = stars.filter((star) => star.sparkle).length;
        expect(sparkles).toBeGreaterThanOrEqual(2);
        expect(sparkles).toBeLessThanOrEqual(3);
        for (const blob of blobs) {
          expect(blob.base).toBeGreaterThanOrEqual(0.14);
          expect(blob.base).toBeLessThanOrEqual(0.55);
          expect(blob.blurPx).toBeGreaterThanOrEqual(30);
          expect(blob.blurPx).toBeLessThanOrEqual(50);
          expect(blob.driftSec).toBeGreaterThanOrEqual(22);
          expect(blob.driftSec).toBeLessThanOrEqual(40);
        }
        for (const star of stars) expect([1, 2]).toContain(star.sizePx);
      }
    }
  });

  it('cerca de um quinto das estrelas pisca', () => {
    const stars = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].flatMap((seed) => nebulaLayout(seed, 'wide').stars);
    const ratio = stars.filter((star) => star.twinkle).length / stars.length;
    expect(ratio).toBeGreaterThan(0.12);
    expect(ratio).toBeLessThan(0.28);
  });
});

describe('blobOpacity', () => {
  it('base vezes intensidade, com teto em 1', () => {
    expect(blobOpacity(0.5, 0.3)).toBeCloseTo(0.15, 9);
    expect(blobOpacity(0.55, 1.6)).toBeCloseTo(0.88, 9);
    expect(blobOpacity(0.8, 1.6)).toBe(1);
    expect(blobOpacity(0.5, 0)).toBe(0);
  });
});

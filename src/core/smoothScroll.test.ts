import { describe, expect, it } from 'vitest';

import {
  SMOOTH_SCROLL,
  SMOOTH_SCROLL_LAMBDA,
  WHEEL_DELTA_LINE,
  WHEEL_DELTA_PAGE,
  canScrollVertically,
  clampScroll,
  movedExternally,
  stepScroll,
  wheelPixels,
} from './smoothScroll';

describe('wheelPixels', () => {
  it('converte linhas e páginas em pixels', () => {
    expect(wheelPixels(100, 0, 800)).toBe(100);
    expect(wheelPixels(3, WHEEL_DELTA_LINE, 800)).toBe(3 * SMOOTH_SCROLL.lineHeightPx);
    expect(wheelPixels(-1, WHEEL_DELTA_PAGE, 800)).toBe(-800);
  });
});

describe('clampScroll', () => {
  it('fica entre o topo e o fim', () => {
    expect(clampScroll(-40, 1000)).toBe(0);
    expect(clampScroll(1200, 1000)).toBe(1000);
    expect(clampScroll(300, 1000)).toBe(300);
  });

  it('conteúdo menor que a tela não rola', () => {
    expect(clampScroll(300, -20)).toBe(0);
  });
});

describe('stepScroll', () => {
  it('a 60 fps anda a fração por quadro do perfil', () => {
    const step = stepScroll(0, 1000, SMOOTH_SCROLL_LAMBDA, 1 / 60);
    expect(step.top).toBeCloseTo(1000 * SMOOTH_SCROLL.perFrameK, 6);
    expect(step.done).toBe(false);
  });

  it('não depende da taxa de quadros', () => {
    let at60 = 0;
    for (let i = 0; i < 60; i += 1) at60 = stepScroll(at60, 1000, SMOOTH_SCROLL_LAMBDA, 1 / 60).top;
    let at120 = 0;
    for (let i = 0; i < 120; i += 1) at120 = stepScroll(at120, 1000, SMOOTH_SCROLL_LAMBDA, 1 / 120).top;
    expect(at120).toBeCloseTo(at60, 6);
  });

  it('assenta exatamente no alvo, sem cauda infinita', () => {
    let step = { top: 0, done: false };
    let frames = 0;
    while (!step.done && frames < 1000) {
      step = stepScroll(step.top, 600, SMOOTH_SCROLL_LAMBDA, 1 / 60);
      frames += 1;
    }
    expect(step).toEqual({ top: 600, done: true });
    expect(frames).toBeLessThan(120);
  });
});

describe('movedExternally', () => {
  it('ignora o arredondamento do navegador e nota a barra arrastada', () => {
    expect(movedExternally(120, 119.6)).toBe(false);
    expect(movedExternally(480, 120)).toBe(true);
  });
});

describe('canScrollVertically', () => {
  const box = (scrollTop: number) => ({ scrollTop, scrollHeight: 1000, clientHeight: 400 });

  it('respeita as pontas em cada direção', () => {
    expect(canScrollVertically(box(0), -1)).toBe(false);
    expect(canScrollVertically(box(0), 1)).toBe(true);
    expect(canScrollVertically(box(600), 1)).toBe(false);
    expect(canScrollVertically(box(600), -1)).toBe(true);
  });

  it('caixa sem conteúdo a mais nunca rola', () => {
    expect(canScrollVertically({ scrollTop: 0, scrollHeight: 400, clientHeight: 400 }, 1)).toBe(false);
  });
});

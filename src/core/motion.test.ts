import { describe, expect, it } from 'vitest';

import {
  DRAG_CLICK_THRESHOLD_PX,
  INERTIA,
  MAX_FRAME_DELTA_S,
  OPEN_DELAY_MS,
  PER_FRAME_K,
  REFERENCE_FPS,
  lambdaFor,
  lambdas,
  stepInertia,
} from './motion';
import { damp } from '../utils/damp';

describe('PER_FRAME_K', () => {
  it('reproduz a tabela do handoff', () => {
    expect(PER_FRAME_K.normal).toEqual({
      enter: 0.055,
      pan: 0.062,
      zoom: 0.055,
      readerFade: 0.085,
      mouse: 0.05,
    });
    expect(PER_FRAME_K.reduced).toEqual({
      enter: 0.16,
      pan: 0.3,
      zoom: 0.3,
      readerFade: 0.3,
      mouse: 0.05,
    });
  });

  it('acelera tudo com movimento reduzido, menos o mouse', () => {
    expect(PER_FRAME_K.reduced.enter).toBeGreaterThan(PER_FRAME_K.normal.enter);
    expect(PER_FRAME_K.reduced.pan).toBeGreaterThan(PER_FRAME_K.normal.pan);
    expect(PER_FRAME_K.reduced.zoom).toBeGreaterThan(PER_FRAME_K.normal.zoom);
    expect(PER_FRAME_K.reduced.readerFade).toBeGreaterThan(PER_FRAME_K.normal.readerFade);
    expect(PER_FRAME_K.reduced.mouse).toBe(PER_FRAME_K.normal.mouse);
  });
});

describe('lambdaFor', () => {
  it('num quadro de 60fps reproduz exatamente o passo do coeficiente original', () => {
    // É isto que preserva a sensação do protótipo depois de trocar o lerp por
    // quadro pela suavização exponencial.
    for (const k of [0.05, 0.055, 0.062, 0.085, 0.16, 0.3]) {
      expect(damp(0, 1, lambdaFor(k), 1 / REFERENCE_FPS)).toBeCloseTo(k, 12);
    }
  });

  it('faz o resultado deixar de depender do framerate', () => {
    // O lerp cru do protótipo caminha mais a 144Hz que a 60Hz no mesmo tempo.
    const lambda = lambdaFor(0.055);
    const seconds = 1;

    let at60 = 0;
    for (let i = 0; i < 60; i += 1) at60 = damp(at60, 1, lambda, seconds / 60);

    let at144 = 0;
    for (let i = 0; i < 144; i += 1) at144 = damp(at144, 1, lambda, seconds / 144);

    expect(at144).toBeCloseTo(at60, 9);
  });

  it('não move nada quando o coeficiente é zero', () => {
    expect(lambdaFor(0)).toBe(0);
  });
});

describe('lambdas', () => {
  it('entrega o perfil já convertido, conforme a preferência', () => {
    expect(lambdas(false).enter).toBeCloseTo(lambdaFor(PER_FRAME_K.normal.enter), 12);
    expect(lambdas(true).pan).toBeCloseTo(lambdaFor(PER_FRAME_K.reduced.pan), 12);
  });
});

describe('stepInertia', () => {
  it('decai a cada quadro', () => {
    expect(stepInertia(10)).toBeCloseTo(10 * INERTIA.decay, 12);
  });

  it('zera abaixo do limiar em vez de arrastar para sempre', () => {
    expect(stepInertia(0.1)).toBe(0);
    expect(stepInertia(-0.1)).toBe(0);
  });

  it('trata as duas direções igual', () => {
    expect(stepInertia(-10)).toBeCloseTo(-stepInertia(10), 12);
  });

  it('converge para zero em tempo finito', () => {
    let velocity = 400;
    let frames = 0;
    while (velocity !== 0 && frames < 1000) {
      velocity = stepInertia(velocity);
      frames += 1;
    }
    expect(velocity).toBe(0);
    expect(frames).toBeLessThan(200);
  });
});

describe('constantes de interação', () => {
  it('mantém os valores do handoff', () => {
    expect(INERTIA.releaseBoost).toBe(1.2);
    expect(INERTIA.decay).toBe(0.955);
    expect(INERTIA.stopBelow).toBe(0.15);
    expect(DRAG_CLICK_THRESHOLD_PX).toBe(6);
    expect(OPEN_DELAY_MS.normal).toBe(760);
    expect(OPEN_DELAY_MS.reduced).toBe(120);
  });

  it('limita o delta de quadro para a aba em segundo plano não dar salto', () => {
    expect(MAX_FRAME_DELTA_S).toBe(0.05);
  });
});

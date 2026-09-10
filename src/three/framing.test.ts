import { describe, expect, it } from 'vitest';

import {
  CAMERA_BASE_Z,
  CAMERA_FOV_DEG,
  MIN_BAND_PX,
  MIN_BASE_SCALE,
  computeFraming,
  visibleHeight,
} from './framing';
import type { FramingInput } from './framing';

const DESKTOP: FramingInput = {
  viewportWidth: 1440,
  viewportHeight: 900,
  headerHeightPx: 76,
  textBlockTopPx: 620,
};

describe('visibleHeight', () => {
  it('é a altura do frustum na distância dada', () => {
    const expected = 2 * CAMERA_BASE_Z * Math.tan((CAMERA_FOV_DEG * Math.PI) / 360);
    expect(visibleHeight(CAMERA_BASE_Z, CAMERA_FOV_DEG)).toBeCloseTo(expected, 12);
  });

  it('cresce com a distância', () => {
    expect(visibleHeight(8, CAMERA_FOV_DEG)).toBeGreaterThan(
      visibleHeight(4, CAMERA_FOV_DEG),
    );
  });
});

describe('computeFraming — guardas de medida inválida', () => {
  // Os dois bugs sérios do protótipo nasceram aqui: window.innerWidth/Height
  // podem ser 0 no primeiro mount, e o NaN resultante fica permanente.
  it('recusa largura zero', () => {
    expect(computeFraming({ ...DESKTOP, viewportWidth: 0 })).toBeNull();
  });

  it('recusa altura zero', () => {
    expect(computeFraming({ ...DESKTOP, viewportHeight: 0 })).toBeNull();
  });

  it('recusa medidas negativas', () => {
    expect(computeFraming({ ...DESKTOP, viewportWidth: -100 })).toBeNull();
  });

  it('recusa NaN e Infinity em qualquer campo', () => {
    for (const field of [
      'viewportWidth',
      'viewportHeight',
      'headerHeightPx',
      'textBlockTopPx',
    ] as const) {
      expect(computeFraming({ ...DESKTOP, [field]: Number.NaN })).toBeNull();
      expect(computeFraming({ ...DESKTOP, [field]: Number.POSITIVE_INFINITY })).toBeNull();
    }
  });
});

describe('computeFraming — resultado', () => {
  it('nunca produz NaN com entrada válida', () => {
    for (let width = 320; width <= 2560; width += 40) {
      for (let height = 360; height <= 1600; height += 40) {
        const framing = computeFraming({
          viewportWidth: width,
          viewportHeight: height,
          headerHeightPx: 76,
          textBlockTopPx: height * 0.7,
        });
        expect(framing).not.toBeNull();
        expect(Number.isFinite(framing?.baseScale)).toBe(true);
        expect(Number.isFinite(framing?.baseY)).toBe(true);
      }
    }
  });

  it('mantém a escala acima do piso', () => {
    const apertado = computeFraming({
      viewportWidth: 320,
      viewportHeight: 360,
      headerHeightPx: 76,
      textBlockTopPx: 100,
    });
    expect(apertado?.baseScale).toBeGreaterThanOrEqual(MIN_BASE_SCALE);
  });

  it('garante a banda mínima quando o texto invade o header', () => {
    // Bloco de texto colado no header: a banda seria negativa.
    const framing = computeFraming({ ...DESKTOP, textBlockTopPx: 80 });
    expect((framing?.bandBottomPx ?? 0) - (framing?.bandTopPx ?? 0)).toBe(MIN_BAND_PX);
  });

  it('limita o raio pela largura em telas estreitas', () => {
    // Numa tela alta e estreita quem manda é a largura, senão o núcleo
    // transborda lateralmente.
    const estreita = computeFraming({
      viewportWidth: 380,
      viewportHeight: 1400,
      headerHeightPx: 76,
      textBlockTopPx: 1100,
    });
    const larga = computeFraming({
      viewportWidth: 1600,
      viewportHeight: 1400,
      headerHeightPx: 76,
      textBlockTopPx: 1100,
    });
    expect(estreita?.baseScale).toBeLessThan(larga?.baseScale ?? 0);
  });

  it('posiciona o núcleo acima do centro quando a banda está acima', () => {
    // baseY positivo significa acima do centro, no sistema do Three.
    const framing = computeFraming(DESKTOP);
    expect(framing?.baseY).toBeGreaterThan(0);
  });

  it('centraliza verticalmente quando a banda está no meio da tela', () => {
    const framing = computeFraming({
      viewportWidth: 1440,
      viewportHeight: 1000,
      headerHeightPx: 0,
      // banda vai de 14 a 986+14=1000, centro em 507... para centrar em 500
      // o bloco precisa estar em 1010: 14 + (1010-24-14)/2 = 500.
      textBlockTopPx: 1010,
    });
    expect(framing?.baseY ?? 1).toBeCloseTo(0, 6);
  });

  it('uma banda maior produz um núcleo maior, até o limite da largura', () => {
    const baixa = computeFraming({ ...DESKTOP, textBlockTopPx: 300 });
    const alta = computeFraming({ ...DESKTOP, textBlockTopPx: 600 });
    expect(alta?.baseScale).toBeGreaterThan(baixa?.baseScale ?? 0);
  });
});

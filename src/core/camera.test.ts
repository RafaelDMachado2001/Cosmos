import { describe, expect, it } from 'vitest';

import { closeReader, goHome, jumpTo, openStar, slideTo } from './camera';
import type { CameraState } from './camera';

function base(overrides: Partial<CameraState> = {}): CameraState {
  return {
    enter: 1,
    enterS: 1,
    pan: 0,
    panS: 0,
    zoomS: 0,
    focusX: 0,
    velocity: 0,
    ...overrides,
  };
}

describe('camera', () => {
  it('fechar o leitor devolve exatamente o pan de onde a estrela foi aberta', () => {
    const bounds = { min: -1000, max: 1000 };
    const aberto = openStar(base({ pan: 120 }), { pan: 480, x: 1100 });
    const fechado = closeReader(aberto, 120, bounds);

    expect(fechado.pan).toBe(120);
  });

  it('nao devolve um pan fora dos limites quando o acervo encolheu', () => {
    const bounds = { min: -100, max: 100 };
    expect(closeReader(base({ pan: 0 }), 5000, bounds).pan).toBe(100);
  });

  it('fechar sem origem guardada nao move a camera', () => {
    const bounds = { min: -1000, max: 1000 };
    expect(closeReader(base({ pan: 300, velocity: 4 }), null, bounds)).toEqual(
      base({ pan: 300, velocity: 0 }),
    );
  });

  it('abrir mede o foco depois do pan limitado, nao no meio da tela', () => {
    const aberto = openStar(base({ pan: 0, enter: 0, velocity: 3 }), { pan: 480, x: 1100 });

    expect(aberto.pan).toBe(480);
    expect(aberto.focusX).toBe(620);
    expect(aberto.enter).toBe(1);
    expect(aberto.velocity).toBe(0);
  });

  it('abrir mexe so no alvo: a suavizacao continua de onde estava', () => {
    const aberto = openStar(base({ pan: 0, panS: 10 }), { pan: 480, x: 1100 });
    expect(aberto.panS).toBe(10);
  });

  it('a chegada pela URL escreve alvo e suavizado juntos, sem encenar a travessia', () => {
    const chegou = jumpTo(base({ enter: 0, enterS: 0, pan: 0, panS: 0 }), { pan: 480, x: 1100 });

    expect(chegou).toMatchObject({ enter: 1, enterS: 1, pan: 480, panS: 480, zoomS: 1 });
    expect(chegou.focusX).toBe(620);
  });

  it('a chegada sem estrela so atravessa o portal', () => {
    const chegou = jumpTo(base({ enter: 0, enterS: 0, pan: 50, panS: 50 }), null);
    expect(chegou).toEqual(base({ pan: 50, panS: 50 }));
  });

  it('voltar ao inicio fecha o portal na borda esquerda e mata a inercia', () => {
    const bounds = { min: -200, max: 900 };
    expect(goHome(base({ pan: 500, velocity: 8 }), bounds)).toEqual(
      base({ enter: 0, pan: -200, velocity: 0 }),
    );
  });

  it('deslizar ate a estrela muda o alvo sem abrir nada', () => {
    const deslizou = slideTo(base({ enter: 0, pan: 0, velocity: 5, zoomS: 0 }), 700);
    expect(deslizou).toEqual(base({ enter: 1, pan: 700, velocity: 0 }));
  });
});

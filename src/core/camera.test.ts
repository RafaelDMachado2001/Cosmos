import { describe, expect, it } from 'vitest';

import { closeReader, goHome, jumpTo, openStar, settle, slideTo } from './camera';
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

describe('câmera', () => {
  it('fechar o leitor devolve exatamente o pan de onde a estrela foi aberta', () => {
    const bounds = { min: -1000, max: 1000 };
    const aberto = openStar(base({ pan: 120 }), { pan: 480, x: 1100 });
    const fechado = closeReader(aberto, 120, bounds);

    expect(fechado.pan).toBe(120);
  });

  it('não devolve um pan fora dos limites quando o acervo encolheu', () => {
    const bounds = { min: -100, max: 100 };
    expect(closeReader(base({ pan: 0 }), 5000, bounds).pan).toBe(100);
  });

  it('fechar sem origem guardada não move a câmera', () => {
    const bounds = { min: -1000, max: 1000 };
    expect(closeReader(base({ pan: 300, velocity: 4 }), null, bounds)).toEqual(
      base({ pan: 300, velocity: 0 }),
    );
  });

  it('abrir mede o foco depois do pan limitado, não no meio da tela', () => {
    const aberto = openStar(base({ pan: 0, enter: 0, velocity: 3 }), { pan: 480, x: 1100 });

    expect(aberto.pan).toBe(480);
    expect(aberto.focusX).toBe(620);
    expect(aberto.enter).toBe(1);
    expect(aberto.velocity).toBe(0);
  });

  it('abrir mexe só no alvo: a suavização continua de onde estava', () => {
    const aberto = openStar(base({ pan: 0, panS: 10 }), { pan: 480, x: 1100 });
    expect(aberto.panS).toBe(10);
  });

  it('a chegada pela URL escreve alvo e suavizado juntos, sem encenar a travessia', () => {
    const chegou = jumpTo(base({ enter: 0, enterS: 0, pan: 0, panS: 0 }), { pan: 480, x: 1100 });

    expect(chegou).toMatchObject({ enter: 1, enterS: 1, pan: 480, panS: 480, zoomS: 1 });
    expect(chegou.focusX).toBe(620);
  });

  it('a chegada sem estrela só atravessa o portal', () => {
    const chegou = jumpTo(base({ enter: 0, enterS: 0, pan: 50, panS: 50 }), null);
    expect(chegou).toEqual(base({ pan: 50, panS: 50 }));
  });

  it('voltar ao inicio fecha o portal no enquadramento de chegada e mata a inercia', () => {
    expect(goHome(base({ pan: 500, velocity: 8 }), 900)).toEqual(
      base({ enter: 0, pan: 900, velocity: 0 }),
    );
  });

  it('deslizar até a estrela muda o alvo sem abrir nada', () => {
    const deslizou = slideTo(base({ enter: 0, pan: 0, velocity: 5, zoomS: 0 }), 700);
    expect(deslizou).toEqual(base({ enter: 1, pan: 700, velocity: 0 }));
  });

  it('na entrada, leva o pan à mais recente sem encenar a viagem', () => {
    // O acervo vai de x≈4700 a 9000 e o pan nasce em 0.
    const bounds = { min: 4700, max: 9000 };
    expect(settle(base({ enter: 0, enterS: 0, velocity: 2 }), bounds, 8200)).toEqual(
      base({ enter: 0, enterS: 0, pan: 8200, panS: 8200, velocity: 0 }),
    );
  });

  it('antes da travessia, um pan já dentro dos limites também vai à chegada', () => {
    // O acervo semente chega antes da API: os limites crescem, a chegada muda.
    const bounds = { min: 0, max: 9000 };
    const antes = base({ enter: 0.5, enterS: 0.5, pan: 3000, panS: 3000 });
    expect(settle(antes, bounds, 8200)).toMatchObject({ pan: 8200, panS: 8200 });
  });

  it('com a constelação assentada, muda só o alvo e deixa o damp deslizar', () => {
    const bounds = { min: 0, max: 800 };
    expect(settle(base({ pan: 1200, panS: 1200 }), bounds, 400)).toEqual(
      base({ pan: 800, panS: 1200 }),
    );
  });

  it('não toca no estado quando o pan já está dentro dos limites', () => {
    const state = base({ pan: 300, panS: 280, velocity: 3 });
    expect(settle(state, { min: 0, max: 800 }, 600)).toBe(state);
  });
});

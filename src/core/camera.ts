/**
 * A câmera da constelação, como funções puras de estado para estado.
 *
 * O motor guarda este estado num ref e o aplica a cada quadro; aqui ficam só as
 * transições discretas — abrir, fechar, chegar, voltar. E onde moravam os
 * defeitos de câmera desfazendo o recuo que o fechamento promete, e fora do
 * hook eles passam a ter teste.
 *
 * O alvo chega resolvido: quem chama faz o `panForStar`, que precisa do acervo e
 * da largura da tela. Modulo puro: sem DOM, sem React, sem Three.
 */

import type { PanBounds } from './geometry';

export interface CameraState {
  /** Alvo da travessia do portal: 0 na entrada, 1 na constelação. */
  readonly enter: number;
  readonly enterS: number;
  /** Alvo do pan. O suavizado, `panS`, e o que vai para a tela. */
  readonly pan: number;
  readonly panS: number;
  readonly zoomS: number;
  /** x em tela da estrela aberta — origem do avanço da câmera. */
  readonly focusX: number;
  readonly velocity: number;
}

/** Onde uma estrela põe a câmera: o pan que a enquadra e o x dela na linha. */
export interface CameraTarget {
  readonly pan: number;
  readonly x: number;
}

function clamp(pan: number, bounds: PanBounds): number {
  return Math.min(bounds.max, Math.max(bounds.min, pan));
}

/**
 * Fecha o portal e deixa a constelação de volta no enquadramento de chegada
 * (`homePan`): atravessar de novo dá na mesma vista da primeira vez.
 */
export function goHome<S extends CameraState>(state: S, home: number): S {
  return { ...state, enter: 0, pan: home, velocity: 0 };
}

/**
 * Desliza a câmera até uma estrela, sem abrir nada.
 *
 * É o que a busca e o filtro usam para levar o leitor ao primeiro resultado:
 * apagar as demais sem mover a câmera deixaria a tela vazia quando o que
 * corresponde esta fora do enquadramento.
 */
export function slideTo<S extends CameraState>(state: S, pan: number): S {
  return { ...state, enter: 1, velocity: 0, pan };
}

/**
 * A chegada direta pela URL.
 *
 * Aqui os valores suavizados são escritos junto com os alvos, que é exatamente
 * o que o resto do motor nunca faz. É deliberado: deixar só o alvo poria o
 * `damp` a encenar uma travessia de portal que ninguém pediu. Quem chega pela
 * URL não atravessou nada.
 */
export function jumpTo<S extends CameraState>(state: S, target: CameraTarget | null): S {
  const crossed = { ...state, enter: 1, enterS: 1, velocity: 0 };
  if (target === null) return crossed;
  return {
    ...crossed,
    pan: target.pan,
    panS: target.pan,
    focusX: target.x - target.pan,
    zoomS: 1,
  };
}

/**
 * O primeiro tempo da abertura: centralizar a estrela.
 *
 * O `focusX` e medido depois de o pan ser limitado pelas bordas da linha do
 * tempo — nas pontas a estrela não chega ao meio da tela, e assumir que chegou
 * faria o avanço da câmera crescer em torno do ponto errado. Quem chama guarda
 * `state.pan` antes: e a origem que `closeReader` devolve.
 */
export function openStar<S extends CameraState>(state: S, target: CameraTarget): S {
  return {
    ...state,
    enter: 1,
    velocity: 0,
    pan: target.pan,
    focusX: target.x - target.pan,
  };
}

/**
 * Recua a câmera até o pan que a abertura guardou.
 *
 * Limitado de novo porque o acervo pode ter mudado com o leitor aberto: um pan
 * de antes, fora dos limites de agora, poria a constelação fora da tela.
 */
export function closeReader<S extends CameraState>(
  state: S,
  originPan: number | null,
  bounds: PanBounds,
): S {
  const stopped = { ...state, velocity: 0 };
  if (originPan === null) return stopped;
  return { ...stopped, pan: clamp(originPan, bounds) };
}

/**
 * Acomoda o pan quando os limites mudam: o acervo chega depois do primeiro
 * quadro, e a tela pode mudar de largura.
 *
 * Enquanto a travessia não termina, ninguém viu a constelação ainda: o pan vai
 * direto ao enquadramento de chegada (`home`, a publicação mais recente no
 * centro), e o suavizado salta junto — deslizar dali encenaria uma viagem de
 * milhares de pixels por cima do portal. Com a constelação já assentada (um
 * resize, um acervo novo), o pan de quem já navegou é respeitado: só volta
 * para dentro dos limites, e o `damp` leva até lá.
 */
export function settle<S extends CameraState>(state: S, bounds: PanBounds, home: number): S {
  const crossed = state.enterS >= SETTLED_ENTER;
  const pan = crossed ? clamp(state.pan, bounds) : clamp(home, bounds);
  if (pan === state.pan && (crossed || pan === state.panS)) return state;
  return { ...state, pan, panS: crossed ? state.panS : pan, velocity: 0 };
}

/** Daqui para cima a travessia do portal conta como concluída. */
const SETTLED_ENTER = 0.99;

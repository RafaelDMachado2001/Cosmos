/**
 * A camera da constelacao, como funcoes puras de estado para estado.
 *
 * O motor guarda este estado num ref e o aplica a cada quadro; aqui ficam so as
 * transicoes discretas — abrir, fechar, chegar, voltar. E onde moravam os
 * defeitos de camera desfazendo o recuo que o fechamento promete, e fora do
 * hook eles passam a ter teste.
 *
 * O alvo chega resolvido: quem chama faz o `panForStar`, que precisa do acervo e
 * da largura da tela. Modulo puro: sem DOM, sem React, sem Three.
 */

import type { PanBounds } from './geometry';

export interface CameraState {
  /** Alvo da travessia do portal: 0 na entrada, 1 na constelacao. */
  readonly enter: number;
  readonly enterS: number;
  /** Alvo do pan. O suavizado, `panS`, e o que vai para a tela. */
  readonly pan: number;
  readonly panS: number;
  readonly zoomS: number;
  /** x em tela da estrela aberta — origem do avanco da camera. */
  readonly focusX: number;
  readonly velocity: number;
}

/** Onde uma estrela poe a camera: o pan que a enquadra e o x dela na linha. */
export interface CameraTarget {
  readonly pan: number;
  readonly x: number;
}

function clamp(pan: number, bounds: PanBounds): number {
  return Math.min(bounds.max, Math.max(bounds.min, pan));
}

/** Fecha o portal na borda esquerda da linha do tempo. */
export function goHome<S extends CameraState>(state: S, bounds: PanBounds): S {
  return { ...state, enter: 0, pan: bounds.min, velocity: 0 };
}

/**
 * Desliza a camera ate uma estrela, sem abrir nada.
 *
 * E o que a busca e o filtro usam para levar o leitor ao primeiro resultado:
 * apagar as demais sem mover a camera deixaria a tela vazia quando o que
 * corresponde esta fora do enquadramento.
 */
export function slideTo<S extends CameraState>(state: S, pan: number): S {
  return { ...state, enter: 1, velocity: 0, pan };
}

/**
 * A chegada direta pela URL.
 *
 * Aqui os valores suavizados sao escritos junto com os alvos, que e exatamente
 * o que o resto do motor nunca faz. E deliberado: deixar so o alvo poria o
 * `damp` a encenar uma travessia de portal que ninguem pediu. Quem chega pela
 * URL nao atravessou nada.
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
 * tempo — nas pontas a estrela nao chega ao meio da tela, e assumir que chegou
 * faria o avanco da camera crescer em torno do ponto errado. Quem chama guarda
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
 * Recua a camera ate o pan que a abertura guardou.
 *
 * Limitado de novo porque o acervo pode ter mudado com o leitor aberto: um pan
 * de antes, fora dos limites de agora, poria a constelacao fora da tela.
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

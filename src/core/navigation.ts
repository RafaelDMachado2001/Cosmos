/**
 * A travessia do portal e a navegação pela constelação.
 *
 * Um único progresso contínuo em duas fases: `enter` (0→1) atravessa o portal,
 * e depois disso o mesmo gesto move `pan`. Ao recuar, `pan` volta primeiro e só
 * então `enter` retrocede.
 *
 * Módulo puro: sem DOM, sem React, sem Three.
 */

import type { PanBounds } from './timeline';

export interface NavState {
  /** Progresso da travessia, 0 a 1. */
  readonly enter: number;
  /** Deslocamento horizontal da constelação, em px. */
  readonly pan: number;
}

/** Ganhos de entrada, conforme o handoff e o protótipo. */
export const INPUT = {
  /** Aplicado ao deltaY da roda antes de tudo. */
  wheelGain: 1.05,
  enterGain: 0.00085,
  panGain: 1.15,
  /** Setas e PageUp/PageDown. */
  keyStepPx: 260,
  /** Arraste por toque, no eixo dominante. */
  touchGain: 2.4,
  /** Arraste com ponteiro sobre a constelação. */
  dragGain: 1.35,
} as const;

/**
 * Aplica um deslocamento bruto ao progresso.
 *
 * A fase termina exatamente em `enter === 1`: um gesto grande completa a
 * travessia e para ali, em vez de atravessar o portal e sair deslizando pela
 * constelação no mesmo movimento.
 */
export function push(state: NavState, delta: number, bounds: PanBounds): NavState {
  if (delta === 0) return state;

  if (delta > 0) {
    if (state.enter < 1) {
      return { ...state, enter: Math.min(1, state.enter + delta * INPUT.enterGain) };
    }
    return { ...state, pan: Math.min(bounds.max, state.pan + delta * INPUT.panGain) };
  }

  if (state.pan > bounds.min) {
    return { ...state, pan: Math.max(bounds.min, state.pan + delta * INPUT.panGain) };
  }
  return { ...state, enter: Math.max(0, state.enter + delta * INPUT.enterGain) };
}

/** Acima disto a interface do cosmos assume o header e ganha ponteiro. */
export const COSMOS_PHASE_ENTER = 0.9;

export type Phase = 'hero' | 'cosmos';

export function phaseFor(enter: number): Phase {
  return enter > COSMOS_PHASE_ENTER ? 'cosmos' : 'hero';
}

// ---------------------------------------------------------------------------
// Funções de transferência
//
// As faixas vêm da seção "Transição de portal" do handoff. Ficam aqui, puras e
// testadas, porque tanto o DOM quanto os uniforms do shader as consomem — e
// porque errar uma faixa é o tipo de defeito que só aparece no meio da
// animação, onde é caro de notar.
// ---------------------------------------------------------------------------

function ramp(value: number, from: number, to: number): number {
  return Math.min(1, Math.max(0, (value - from) / (to - from)));
}

/** Opacidade do hero cai de 1 a 0. */
export function heroFade(enter: number): number {
  return ramp(enter, 0.02, 0.44);
}

/** Opacidade do cosmos sobe de 0 a 1. */
export function cosmosReveal(enter: number): number {
  return ramp(enter, 0.62, 0.96);
}

/** uOpacity do shader do núcleo. */
export function coreOpacity(enter: number): number {
  return 1 - ramp(enter, 0.5, 0.92);
}

/** A esfera opaca que dá a impressão de interior vazio. */
export function innerOpacity(enter: number): number {
  return 0.9 * Math.max(0, 1 - enter / 0.7);
}

/** Escala da esfera interna, encolhendo conforme se atravessa. */
export function innerScale(enter: number): number {
  return 1 - enter * 0.45;
}

/** Posição z da câmera: 4.3 na entrada, 0.25 ao atravessar. */
export function cameraZ(enter: number): number {
  return 4.3 - enter * 4.05;
}

/** Amplitude do ruído no vertex shader: 0.34 a 0.84. */
export function coreAmp(enter: number): number {
  return 0.34 + enter * 0.5;
}

/** O núcleo cresce até 3.9x enquanto se aproxima. */
export function coreScale(baseScale: number, enter: number): number {
  return baseScale * (1 + enter * 2.9);
}

/** A poeira avança em z, reforçando a sensação de atravessar. */
export function dustZ(enter: number): number {
  return enter * 6;
}

// ---------------------------------------------------------------------------
// Tradução de entrada
// ---------------------------------------------------------------------------

export type KeyAction =
  | { readonly kind: 'delta'; readonly value: number }
  | { readonly kind: 'home' }
  | { readonly kind: 'end' };

/** Traduz uma tecla em ação de navegação, ou `null` se não for nossa. */
export function keyToDelta(key: string): KeyAction | null {
  switch (key) {
    case 'ArrowRight':
    case 'PageDown':
      return { kind: 'delta', value: INPUT.keyStepPx };
    case 'ArrowLeft':
    case 'PageUp':
      return { kind: 'delta', value: -INPUT.keyStepPx };
    case 'Home':
      return { kind: 'home' };
    case 'End':
      return { kind: 'end' };
    default:
      return null;
  }
}

/**
 * Num arraste por toque, vale o eixo de maior deslocamento.
 *
 * No empate fica o horizontal: é o eixo da constelação, e hesitar entre os
 * dois faria o gesto parecer travado.
 */
export function dominantAxisDelta(deltaX: number, deltaY: number): number {
  return Math.abs(deltaX) >= Math.abs(deltaY) ? deltaX : deltaY;
}

export interface RailRect {
  readonly left: number;
  readonly width: number;
}

/** Arrastar a régua mapeia a posição horizontal direto para o pan. */
export function scrubToPan(clientX: number, rail: RailRect, bounds: PanBounds): number {
  if (rail.width <= 0) return bounds.min;
  const fraction = Math.min(1, Math.max(0, (clientX - rail.left) / rail.width));
  return bounds.min + fraction * (bounds.max - bounds.min);
}

/** Posição do marcador na régua, de 0 a 1. */
export function panToScrubFraction(pan: number, bounds: PanBounds): number {
  const span = bounds.max - bounds.min;
  if (span <= 0) return 0;
  return Math.min(1, Math.max(0, (pan - bounds.min) / span));
}

import type { PanBounds } from './geometry';

export interface NavState {
  readonly enter: number;
  readonly pan: number;
}

export const INPUT = {
  wheelGain: 1.05,
  enterGain: 0.00085,
  panGain: 0.62,
  keyStepPx: 260,
  touchGain: 2.4,
  dragGain: 1,
  inertiaGain: 0.9,
} as const;

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

export const COSMOS_PHASE_ENTER = 0.9;

export type Phase = 'hero' | 'cosmos';

export function phaseFor(enter: number): Phase {
  return enter > COSMOS_PHASE_ENTER ? 'cosmos' : 'hero';
}

function ramp(value: number, from: number, to: number): number {
  return Math.min(1, Math.max(0, (value - from) / (to - from)));
}

export function heroFade(enter: number): number {
  return ramp(enter, 0.02, 0.44);
}

export function cosmosReveal(enter: number): number {
  return ramp(enter, 0.62, 0.96);
}

export function coreOpacity(enter: number): number {
  return 1 - ramp(enter, 0.5, 0.92);
}

export function innerGlow(enter: number): number {
  return Math.max(0, 1 - enter / 0.7);
}

export function innerScale(enter: number): number {
  return 1 - enter * 0.45;
}

export function cameraZ(enter: number): number {
  return 4.3 - enter * 4.05;
}

export function coreAmp(enter: number): number {
  return 0.34 + enter * 0.5;
}

export function coreScale(baseScale: number, enter: number): number {
  return baseScale * (1 + enter * 2.9);
}

export function dustZ(enter: number): number {
  return enter * 6;
}

export type KeyAction =
  | { readonly kind: 'delta'; readonly value: number }
  | { readonly kind: 'home' }
  | { readonly kind: 'end' };

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

export function dominantAxisDelta(deltaX: number, deltaY: number): number {
  return Math.abs(deltaX) >= Math.abs(deltaY) ? deltaX : deltaY;
}

export const FOCUS_MARGIN_PX = 90 + 24;

export function needsSlide(
  screenX: number,
  viewportWidth: number,
  marginPx: number = FOCUS_MARGIN_PX,
): boolean {
  return screenX < marginPx || screenX > viewportWidth - marginPx;
}

export interface RailRect {
  readonly left: number;
  readonly width: number;
}

export function scrubToPan(clientX: number, rail: RailRect, bounds: PanBounds): number {
  if (rail.width <= 0) return bounds.min;
  const fraction = Math.min(1, Math.max(0, (clientX - rail.left) / rail.width));
  return bounds.min + fraction * (bounds.max - bounds.min);
}

export function panToScrubFraction(pan: number, bounds: PanBounds): number {
  const span = bounds.max - bounds.min;
  if (span <= 0) return 0;
  return Math.min(1, Math.max(0, (pan - bounds.min) / span));
}

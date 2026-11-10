import { lambdaFor } from './motion';

export const SMOOTH_SCROLL = {
  perFrameK: 0.1,
  lineHeightPx: 40,
  stopBelowPx: 0.5,
  externalMovePx: 2,
} as const;

export const SMOOTH_SCROLL_LAMBDA = lambdaFor(SMOOTH_SCROLL.perFrameK);

export const WHEEL_DELTA_LINE = 1;
export const WHEEL_DELTA_PAGE = 2;

export function wheelPixels(delta: number, deltaMode: number, pageHeight: number): number {
  if (deltaMode === WHEEL_DELTA_LINE) return delta * SMOOTH_SCROLL.lineHeightPx;
  if (deltaMode === WHEEL_DELTA_PAGE) return delta * pageHeight;
  return delta;
}

export function clampScroll(top: number, max: number): number {
  return Math.min(Math.max(top, 0), Math.max(max, 0));
}

export interface ScrollStep {
  readonly top: number;
  readonly done: boolean;
}

export function stepScroll(current: number, target: number, lambda: number, delta: number): ScrollStep {
  const next = current + (target - current) * (1 - Math.exp(-lambda * delta));
  if (Math.abs(target - next) < SMOOTH_SCROLL.stopBelowPx) return { top: target, done: true };
  return { top: next, done: false };
}

export function movedExternally(actual: number, lastWritten: number): boolean {
  return Math.abs(actual - lastWritten) > SMOOTH_SCROLL.externalMovePx;
}

export interface ScrollBox {
  readonly scrollTop: number;
  readonly scrollHeight: number;
  readonly clientHeight: number;
}

export function canScrollVertically(box: ScrollBox, direction: number): boolean {
  const max = box.scrollHeight - box.clientHeight;
  if (max < 1) return false;
  return direction < 0 ? box.scrollTop > 0 : box.scrollTop < max - 1;
}

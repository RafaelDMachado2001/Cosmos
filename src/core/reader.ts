import type { PlacedStar } from './timeline';

export type ReaderPhase = 'closed' | 'opening' | 'open' | 'closing';

export interface ReaderState {
  readonly phase: ReaderPhase;
  readonly slug: string | null;
  readonly originPan: number | null;
}

export const CLOSED: ReaderState = { phase: 'closed', slug: null, originPan: null };

export function open(state: ReaderState, slug: string, originPan: number): ReaderState {
  if (state.phase === 'opening' || state.phase === 'open') return state;
  return { phase: 'opening', slug, originPan };
}

export function landed(state: ReaderState, slug: string): ReaderState {
  if (state.phase === 'opening' || state.phase === 'open') return state;
  return { phase: 'open', slug, originPan: null };
}

export function mounted(state: ReaderState): ReaderState {
  if (state.phase !== 'opening') return state;
  return { ...state, phase: 'open' };
}

export function close(state: ReaderState): ReaderState {
  if (state.phase === 'closed' || state.phase === 'closing') return state;
  if (state.phase === 'opening') return CLOSED;
  return { ...state, phase: 'closing' };
}

export function settled(state: ReaderState): ReaderState {
  if (state.phase !== 'closing') return state;
  return CLOSED;
}

export function isMounted(state: ReaderState): boolean {
  return state.phase === 'open' || state.phase === 'closing';
}

export function zoomTarget(state: ReaderState): number {
  return state.phase === 'opening' || state.phase === 'open' ? 1 : 0;
}

export const HOVER_FLIP_PX = 58 + 330 + 24;

export const HOVER_DOCK_BELOW_PX = 2 * HOVER_FLIP_PX + 16;

export function hoverDocked(viewportWidth: number): boolean {
  return viewportWidth < HOVER_DOCK_BELOW_PX;
}

export type HoverSide = 'left' | 'right';

export function hoverSide(screenX: number, viewportWidth: number): HoverSide {
  return viewportWidth - screenX < HOVER_FLIP_PX ? 'left' : 'right';
}

export interface TimelinePosition {
  readonly position: number;
  readonly total: number;
}

export function timelinePosition(
  slug: string,
  stars: readonly PlacedStar[],
): TimelinePosition | null {
  const star = stars.find((item) => item.slug === slug);
  if (!star) return null;
  return { position: star.index + 1, total: stars.length };
}

export const ZOOM_SCALE = 1.35;

export const ZOOM_BLUR_PX = 3;

export const ZOOM_DIM = 0.72;

export const READER_MOBILE_MAX_PX = 780;

export const SETTLE_BELOW = 0.02;

export function asideCenterX(viewportWidth: number): number {
  return viewportWidth * (viewportWidth < READER_MOBILE_MAX_PX ? 0.5 : 0.125);
}

export function zoomPush(focusX: number, viewportWidth: number, zoom: number): number {
  return zoom * (focusX - asideCenterX(viewportWidth));
}

export function zoomScale(zoom: number): number {
  return 1 + zoom * ZOOM_SCALE;
}

export function zoomBlurPx(zoom: number): number {
  return zoom * ZOOM_BLUR_PX;
}

export function zoomDim(zoom: number): number {
  return 1 - zoom * ZOOM_DIM;
}

export function timelineLabel(position: TimelinePosition, dateLabel: string): string {
  return `${position.position} / ${position.total}  ·  ${dateLabel}`;
}

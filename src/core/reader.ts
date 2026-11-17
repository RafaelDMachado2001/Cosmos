import type { PlacedStar } from './timeline';

export type ReaderPhase = 'closed' | 'open' | 'closing';

export interface ReaderState {
  readonly phase: ReaderPhase;
  readonly slug: string | null;
  readonly originPan: number | null;
}

export const CLOSED: ReaderState = { phase: 'closed', slug: null, originPan: null };

export function open(state: ReaderState, slug: string, originPan: number): ReaderState {
  if (state.phase === 'open') return state;
  return { phase: 'open', slug, originPan };
}

export function landed(state: ReaderState, slug: string): ReaderState {
  if (state.phase === 'open') return state;
  return { phase: 'open', slug, originPan: null };
}

export function close(state: ReaderState): ReaderState {
  if (state.phase !== 'open') return state;
  return { ...state, phase: 'closing' };
}

export function settled(state: ReaderState): ReaderState {
  if (state.phase !== 'closing') return state;
  return CLOSED;
}

export function isMounted(state: ReaderState): boolean {
  return state.phase === 'open' || state.phase === 'closing';
}

export function veilTarget(state: ReaderState): number {
  return state.phase === 'open' ? 1 : 0;
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

export const VEIL_DIM = 0.72;

export const SETTLE_BELOW = 0.02;

export const OPAQUE_ABOVE = 0.995;

export function veilDim(veil: number): number {
  return 1 - veil * VEIL_DIM;
}

export function timelineLabel(position: TimelinePosition, dateLabel: string): string {
  return `${position.position} / ${position.total}  ·  ${dateLabel}`;
}

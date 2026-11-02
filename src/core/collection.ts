export type CollectionStatus = 'loading' | 'ready' | 'error';

export interface CollectionState<T> {
  readonly status: CollectionStatus;
  readonly items: readonly T[];
  readonly attempt: number;
}

export function loading<T>(): CollectionState<T> {
  return { status: 'loading', items: [], attempt: 0 };
}

export function loaded<T>(
  state: CollectionState<T>,
  items: readonly T[],
): CollectionState<T> {
  return { ...state, status: 'ready', items };
}

export function failed<T>(state: CollectionState<T>): CollectionState<T> {
  return { ...state, status: 'error', items: [] };
}

export function retry<T>(state: CollectionState<T>): CollectionState<T> {
  if (state.status !== 'error') return state;
  return { status: 'loading', items: [], attempt: state.attempt + 1 };
}

export const REVEAL_STEP_MS = 40;

export const REVEAL_MAX_MS = 900;

export function revealDelayMs(index: number, reducedMotion = false): number {
  if (reducedMotion) return 0;
  return Math.min(Math.max(0, index) * REVEAL_STEP_MS, REVEAL_MAX_MS);
}

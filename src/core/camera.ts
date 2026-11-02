import type { PanBounds } from './geometry';

export interface CameraState {
  readonly enter: number;
  readonly enterS: number;
  readonly pan: number;
  readonly panS: number;
  readonly zoomS: number;
  readonly focusX: number;
  readonly velocity: number;
}

export interface CameraTarget {
  readonly pan: number;
  readonly x: number;
}

function clamp(pan: number, bounds: PanBounds): number {
  return Math.min(bounds.max, Math.max(bounds.min, pan));
}

export function goHome<S extends CameraState>(state: S, home: number): S {
  return { ...state, enter: 0, pan: home, velocity: 0 };
}

export function slideTo<S extends CameraState>(state: S, pan: number): S {
  return { ...state, enter: 1, velocity: 0, pan };
}

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

export function openStar<S extends CameraState>(state: S, target: CameraTarget): S {
  return {
    ...state,
    enter: 1,
    velocity: 0,
    pan: target.pan,
    focusX: target.x - target.pan,
  };
}

export function closeReader<S extends CameraState>(
  state: S,
  originPan: number | null,
  bounds: PanBounds,
): S {
  const stopped = { ...state, velocity: 0 };
  if (originPan === null) return stopped;
  return { ...stopped, pan: clamp(originPan, bounds) };
}

export function settle<S extends CameraState>(state: S, bounds: PanBounds, home: number): S {
  const crossed = state.enterS >= SETTLED_ENTER;
  const pan = crossed ? clamp(state.pan, bounds) : clamp(home, bounds);
  if (pan === state.pan && (crossed || pan === state.panS)) return state;
  return { ...state, pan, panS: crossed ? state.panS : pan, velocity: 0 };
}

const SETTLED_ENTER = 0.99;

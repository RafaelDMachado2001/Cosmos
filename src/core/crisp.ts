export const SNAP_EPSILON = 1e-3;

export function snapNear(value: number, target: number, epsilon = SNAP_EPSILON): number {
  return Math.abs(value - target) < epsilon ? target : value;
}

export function snapToPixel(px: number, devicePixelRatio: number): number {
  const ratio = devicePixelRatio > 0 && Number.isFinite(devicePixelRatio) ? devicePixelRatio : 1;
  const snapped = Math.round(px * ratio) / ratio;
  return snapped === 0 ? 0 : snapped;
}

export function blurFilter(px: number): string {
  return px < SNAP_EPSILON ? 'none' : `blur(${px}px)`;
}

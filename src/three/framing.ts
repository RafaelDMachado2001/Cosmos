export const CAMERA_FOV_DEG = 48;
export const CAMERA_BASE_Z = 4.3;

const HEADER_GAP_PX = 14;
const TEXT_GAP_PX = 24;

export const MIN_BAND_PX = 120;

export const MIN_BASE_SCALE = 0.22;

const DEFORMATION_HEADROOM = 0.88;

const MAX_WIDTH_FRACTION = 0.28;

export interface FramingInput {
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly headerHeightPx: number;
  readonly textBlockTopPx: number;
}

export interface Framing {
  readonly baseScale: number;
  readonly baseY: number;
  readonly bandTopPx: number;
  readonly bandBottomPx: number;
}

export function visibleHeight(z: number, fovDeg: number): number {
  return 2 * z * Math.tan((fovDeg * Math.PI) / 360);
}

export function computeFraming(input: FramingInput): Framing | null {
  const { viewportWidth, viewportHeight, headerHeightPx, textBlockTopPx } = input;

  const measurements = [viewportWidth, viewportHeight, headerHeightPx, textBlockTopPx];
  if (measurements.some((value) => !Number.isFinite(value))) return null;
  if (viewportWidth <= 0 || viewportHeight <= 0) return null;

  const bandTopPx = headerHeightPx + HEADER_GAP_PX;
  const band = Math.max(MIN_BAND_PX, textBlockTopPx - TEXT_GAP_PX - bandTopPx);
  const bandBottomPx = bandTopPx + band;
  const centerY = bandTopPx + band / 2;

  const radius = Math.min(
    (band / 2) * DEFORMATION_HEADROOM,
    viewportWidth * MAX_WIDTH_FRACTION,
  );

  const visH = visibleHeight(CAMERA_BASE_Z, CAMERA_FOV_DEG);

  return {
    baseScale: Math.max(MIN_BASE_SCALE, (radius * visH) / (viewportHeight * 1.06)),
    baseY: ((viewportHeight / 2 - centerY) / viewportHeight) * visH,
    bandTopPx,
    bandBottomPx,
  };
}

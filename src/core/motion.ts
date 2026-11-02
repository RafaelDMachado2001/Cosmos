export interface MotionProfile {
  readonly enter: number;
  readonly pan: number;
  readonly zoom: number;
  readonly readerFade: number;
  readonly mouse: number;
}

export const PER_FRAME_K: Record<'normal' | 'reduced', MotionProfile> = {
  normal: { enter: 0.055, pan: 0.062, zoom: 0.055, readerFade: 0.085, mouse: 0.05 },
  reduced: { enter: 0.16, pan: 0.3, zoom: 0.3, readerFade: 0.3, mouse: 0.05 },
};

export const REFERENCE_FPS = 60;

export function lambdaFor(perFrameK: number): number {
  if (perFrameK <= 0) return 0;
  return -REFERENCE_FPS * Math.log(1 - perFrameK);
}

export function lambdas(reduced: boolean): MotionProfile {
  const k = reduced ? PER_FRAME_K.reduced : PER_FRAME_K.normal;
  return {
    enter: lambdaFor(k.enter),
    pan: lambdaFor(k.pan),
    zoom: lambdaFor(k.zoom),
    readerFade: lambdaFor(k.readerFade),
    mouse: lambdaFor(k.mouse),
  };
}

export const INERTIA = {
  releaseBoost: 1.2,
  decay: 0.955,
  stopBelow: 0.15,
} as const;

export function stepInertia(velocity: number): number {
  const next = velocity * INERTIA.decay;
  return Math.abs(next) < INERTIA.stopBelow ? 0 : next;
}

export const DRAG_CLICK_THRESHOLD_PX = 6;

export function isDrag(distancePx: number): boolean {
  return distancePx >= DRAG_CLICK_THRESHOLD_PX;
}

export const OPEN_DELAY_MS = { normal: 760, reduced: 120 } as const;

export const MAX_FRAME_DELTA_S = 0.05;

export const PULSE_DECAY_PER_FRAME = { normal: 0.965, reduced: 0.9 } as const;

export const PULSE_INTERVAL_S = { min: 1.4, max: 5 } as const;

export const TIME_SCALE = { normal: 1, reduced: 0.25 } as const;

export const ATMOSPHERE_TIME_SCALE = { normal: 1, reduced: 0.3 } as const;

const PULSE_LAMBDA = {
  normal: -REFERENCE_FPS * Math.log(PULSE_DECAY_PER_FRAME.normal),
  reduced: -REFERENCE_FPS * Math.log(PULSE_DECAY_PER_FRAME.reduced),
} as const;

export function decayPulse(pulse: number, reduced: boolean, deltaSeconds: number): number {
  const lambda = reduced ? PULSE_LAMBDA.reduced : PULSE_LAMBDA.normal;
  return pulse * Math.exp(-lambda * deltaSeconds);
}

export function nextPulseAt(now: number, random: () => number = Math.random): number {
  return now + PULSE_INTERVAL_S.min + random() * (PULSE_INTERVAL_S.max - PULSE_INTERVAL_S.min);
}

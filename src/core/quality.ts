export interface QualityLevel {
  readonly scale: 1 | 0.5;
  readonly octaves: 5 | 3;
}

export const QUALITY_LEVELS: readonly QualityLevel[] = [
  { scale: 1, octaves: 5 },
  { scale: 0.5, octaves: 5 },
  { scale: 0.5, octaves: 3 },
];

export const QUALITY = {
  slowFrameMs: 20,
  windowMs: 1000,
  narrowWidth: 780,
} as const;

export interface QualityGovernor {
  readonly level: number;
  sample(frameMs: number): boolean;
}

export function createQualityGovernor(): QualityGovernor {
  let level = 0;
  let total = 0;
  let count = 0;

  return {
    get level() {
      return level;
    },
    sample(frameMs: number): boolean {
      total += frameMs;
      count += 1;
      if (total < QUALITY.windowMs) return false;

      const average = total / count;
      total = 0;
      count = 0;
      if (average <= QUALITY.slowFrameMs || level >= QUALITY_LEVELS.length - 1) return false;
      level += 1;
      return true;
    },
  };
}

export function effectiveLevel(governorLevel: number, viewportWidth: number): number {
  return Math.max(governorLevel, viewportWidth < QUALITY.narrowWidth ? 1 : 0);
}

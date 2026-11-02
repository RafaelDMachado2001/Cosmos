export interface Appearance {
  readonly nebula: number;
  readonly motion: boolean;
}

export const NEBULA_MAX = 1.6;

export const DEFAULT_APPEARANCE: Appearance = { nebula: 0.3, motion: true };

function clampNebula(value: number): number {
  return Math.min(NEBULA_MAX, Math.max(0, value));
}

export function parseAppearance(value: unknown): Appearance | null {
  if (typeof value !== 'object' || value === null) return null;
  const { nebula, motion } = value as Record<string, unknown>;
  if (typeof nebula !== 'number' || !Number.isFinite(nebula) || typeof motion !== 'boolean') return null;
  return { nebula: clampNebula(nebula), motion };
}

export function resolveAppearance(override: Appearance | null | undefined): Appearance {
  return override ?? DEFAULT_APPEARANCE;
}

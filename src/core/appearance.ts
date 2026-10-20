/**
 * A aparência de uma publicação na tela de leitura: quanto de nebulosa e se
 * ela se move.
 *
 * `null` no banco é "herdar da categoria" — hoje, o padrão global abaixo; as
 * quatro categorias têm paleta própria (`tokens.css`), não aparência própria.
 * Um valor gravado sobrescreve o padrão inteiro.
 *
 * Módulo puro: sem DOM, sem React, sem Three.
 */

export interface Appearance {
  /** Intensidade da nebulosa, de 0 a `NEBULA_MAX`. A leitura é prioridade. */
  readonly nebula: number;
  readonly motion: boolean;
}

export const NEBULA_MAX = 1.6;

export const DEFAULT_APPEARANCE: Appearance = { nebula: 0.3, motion: true };

function clampNebula(value: number): number {
  return Math.min(NEBULA_MAX, Math.max(0, value));
}

/**
 * O que veio da API (ou do banco) -> uma aparência válida, ou `null` para
 * herdar. Qualquer forma inesperada também herda: a tela de leitura nunca
 * deixa de abrir por causa de um campo decorativo.
 */
export function parseAppearance(value: unknown): Appearance | null {
  if (typeof value !== 'object' || value === null) return null;
  const { nebula, motion } = value as Record<string, unknown>;
  if (typeof nebula !== 'number' || !Number.isFinite(nebula) || typeof motion !== 'boolean') return null;
  return { nebula: clampNebula(nebula), motion };
}

export function resolveAppearance(override: Appearance | null | undefined): Appearance {
  return override ?? DEFAULT_APPEARANCE;
}

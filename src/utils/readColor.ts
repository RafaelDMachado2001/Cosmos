import type { Rgb } from '../core/atmosphere';

/**
 * Lê um token de cor do CSS para alimentar a cena WebGL. É o que impede o shader
 * e a folha de estilo de divergirem quando um token muda.
 */
export function readColor(token: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const value = window.getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  return value === '' ? fallback : value;
}

/** `#rrggbb` em componentes 0–1, para uniforms. Formatos curtos caem no fallback. */
export function hexToRgb(hex: string, fallback: Rgb): Rgb {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match?.[1]) return fallback;
  const value = parseInt(match[1], 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

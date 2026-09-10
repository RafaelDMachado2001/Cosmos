/**
 * Lê um token de cor do CSS para alimentar a cena WebGL. É o que impede o shader
 * e a folha de estilo de divergirem quando um token muda.
 */
export function readColor(token: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const value = window.getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  return value === '' ? fallback : value;
}

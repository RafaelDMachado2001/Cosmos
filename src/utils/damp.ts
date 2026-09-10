/**
 * Suavização exponencial independente de framerate: o mesmo `lambda` produz a
 * mesma curva a 30 ou a 144fps, o que um lerp por quadro não garante.
 */
export function damp(current: number, target: number, lambda: number, delta: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * delta));
}

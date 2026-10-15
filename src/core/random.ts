/**
 * PRNG determinístico (mulberry32): mesma semente, mesma sequência.
 *
 * É o que mantém reproduzível tudo o que parece aleatório sem ser — o céu
 * procedural e o acervo sintético de teste de carga.
 *
 * Módulo puro: sem DOM, sem React, sem Three.
 */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

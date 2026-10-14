/**
 * O hash que decide a altura de cada estrela.
 *
 * Separado da colocacao temporal porque e contrato com o backend: o PHP precisa
 * reproduzir exatamente estes bits, e mexer aqui move toda a constelacao.
 *
 * Modulo puro: sem DOM, sem React, sem Three.
 */

export const FNV_OFFSET_BASIS = 2166136261; // 0x811c9dc5
export const FNV_PRIME = 16777619; // 0x01000193

const encoder = new TextEncoder();

/**
 * FNV-1a de 32 bits sobre os BYTES UTF-8 da entrada.
 *
 * A codificação é parte do contrato, não um detalhe: o protótipo usava
 * `charCodeAt` (code units UTF-16) e o PHP percorre bytes UTF-8. Os dois
 * divergem em qualquer entrada acentuada, e as estrelas mudariam de altura no
 * dia em que o backend assumisse o cálculo. Ao portar para PHP, lembrar do
 * clamp: `$h = ($h ^ $byte) * FNV_PRIME & 0xFFFFFFFF;` — sem ele a
 * multiplicação vira float acima de 2^53.
 */
export function fnv1a32(input: string): number {
  let hash = FNV_OFFSET_BASIS;
  for (const byte of encoder.encode(input)) {
    hash ^= byte;
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

/**
 * Normaliza o hash para [0, 1) em 10.000 passos.
 *
 * A quantização vem do protótipo e é mantida de propósito: é a forma mais
 * barata de reproduzir em PHP. Com 10.000 valores distintos, algumas centenas
 * de publicações produzem alguns pares de mesma altura — inofensivo, já que
 * precisariam também ser vizinhas no eixo do tempo para se notar.
 */
export function hash01(input: string): number {
  return (fnv1a32(input) % 10000) / 10000;
}

export const FNV_OFFSET_BASIS = 2166136261; // 0x811c9dc5
export const FNV_PRIME = 16777619; // 0x01000193

const encoder = new TextEncoder();

export function fnv1a32(input: string): number {
  let hash = FNV_OFFSET_BASIS;
  for (const byte of encoder.encode(input)) {
    hash ^= byte;
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

export function hash01(input: string): number {
  return (fnv1a32(input) % 10000) / 10000;
}

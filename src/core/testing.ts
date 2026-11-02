import type { Category, PublicationInput } from './types';

const CATEGORIES: readonly Category[] = ['artigo', 'projeto', 'estudo', 'rotina'];

export function makeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface DatasetOptions {
  readonly count: number;
  readonly spanDays: number;
  readonly startISO?: string;
}

export function makeDataset(random: () => number, options: DatasetOptions): PublicationInput[] {
  const start = Date.parse(`${options.startISO ?? '2024-01-01'}T00:00:00.000Z`);
  const items: PublicationInput[] = [];
  for (let i = 0; i < options.count; i += 1) {
    const offsetDays = Math.floor(random() * options.spanDays);
    const category = CATEGORIES[Math.floor(random() * CATEGORIES.length)] ?? 'artigo';
    items.push({
      slug: `pub-${i}`,
      publishedAt: new Date(start + offsetDays * 86400000).toISOString(),
      category,
    });
  }
  return items.sort((a, b) => Date.parse(a.publishedAt) - Date.parse(b.publishedAt));
}

export function makeNewer(items: readonly PublicationInput[], slug: string): PublicationInput {
  const latest = items.reduce((max, item) => Math.max(max, Date.parse(item.publishedAt)), 0);
  return {
    slug,
    publishedAt: new Date(latest + 86400000).toISOString(),
    category: 'artigo',
  };
}

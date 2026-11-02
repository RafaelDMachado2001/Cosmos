import { hash01 } from './hash';
import type { Category, PublicationInput } from './types';

export interface TimelineConfig {
  readonly epochISO: string;
  readonly originX: number;
  readonly gapPxPerDay: number;
  readonly minGapPx: number;
  readonly trailingPadPx: number;
}

export const TIMELINE: TimelineConfig = {
  epochISO: '2024-01-01',
  originX: 300,
  gapPxPerDay: 4.6,
  minGapPx: 200,
  trailingPadPx: 380,
};

export const MS_PER_DAY = 86400000;

export interface PlacedStar {
  readonly slug: string;
  readonly timestamp: number;
  readonly index: number;
  readonly dateX: number;
  readonly x: number;
  readonly pushPx: number;
  readonly y01: number;
  readonly category: Category;
  readonly featured: boolean;
}

export function dayOffset(iso: string, epochISO: string = TIMELINE.epochISO): number {
  const epoch = Date.parse(`${epochISO}T00:00:00.000Z`);
  return (Date.parse(iso) - epoch) / MS_PER_DAY;
}

export function dateX(iso: string, config: TimelineConfig = TIMELINE): number {
  return config.originX + dayOffset(iso, config.epochISO) * config.gapPxPerDay;
}

export function placeStars(
  items: readonly PublicationInput[],
  config: TimelineConfig = TIMELINE,
): readonly PlacedStar[] {
  const sorted = [...items].sort((a, b) => {
    const byTime = Date.parse(a.publishedAt) - Date.parse(b.publishedAt);
    return byTime !== 0 ? byTime : a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
  });

  const placed: PlacedStar[] = [];
  let previousX = Number.NEGATIVE_INFINITY;

  for (const [index, item] of sorted.entries()) {
    const itemDateX = dateX(item.publishedAt, config);
    const x = Math.max(itemDateX, previousX + config.minGapPx);
    previousX = x;

    placed.push({
      slug: item.slug,
      timestamp: Date.parse(item.publishedAt),
      index,
      dateX: itemDateX,
      x,
      pushPx: x - itemDateX,
      y01: hash01(item.slug),
      category: item.category,
      featured: item.featured ?? false,
    });
  }

  return placed;
}

export interface LayoutHealth {
  readonly widthPx: number;
  readonly minSpacingPx: number;
  readonly medianSpacingPx: number;
  readonly pushedCount: number;
  readonly pushedRatio: number;
}

export function layoutHealth(stars: readonly PlacedStar[]): LayoutHealth {
  if (stars.length === 0) {
    return {
      widthPx: 0,
      minSpacingPx: Number.POSITIVE_INFINITY,
      medianSpacingPx: 0,
      pushedCount: 0,
      pushedRatio: 0,
    };
  }

  const gaps: number[] = [];
  for (let i = 1; i < stars.length; i += 1) {
    gaps.push((stars[i]?.x ?? 0) - (stars[i - 1]?.x ?? 0));
  }
  gaps.sort((a, b) => a - b);

  const first = stars[0]?.x ?? 0;
  const last = stars[stars.length - 1]?.x ?? 0;
  const pushedCount = stars.filter((star) => star.pushPx > 0).length;

  return {
    widthPx: last - first,
    minSpacingPx: gaps[0] ?? Number.POSITIVE_INFINITY,
    medianSpacingPx: gaps.length === 0 ? 0 : (gaps[Math.floor(gaps.length / 2)] ?? 0),
    pushedCount,
    pushedRatio: pushedCount / stars.length,
  };
}

export function suggestGapPxPerDay(
  items: readonly PublicationInput[],
  targetSpacingPx = 120,
): number {
  if (items.length < 2) return TIMELINE.gapPxPerDay;

  const times = items.map((item) => Date.parse(item.publishedAt));
  const spanDays = (Math.max(...times) - Math.min(...times)) / MS_PER_DAY;
  if (spanDays <= 0) return 40;

  return Math.min(40, Math.max(0.6, ((items.length - 1) * targetSpacingPx) / spanDays));
}

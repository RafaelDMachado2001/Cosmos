import { MS_PER_DAY, TIMELINE } from './timeline';
import type { PlacedStar, TimelineConfig } from './timeline';
import type { Band, Viewport } from './types';

export const AXIS_PCT = 0.58;

const MAX_SPREAD_PCT = 0.25;

const MIN_BAND_PX = 120;

const GUTTER_PX = 24;

export const CAPTION_BELOW_PX = 102;

export function resolveBand(viewport: Viewport): Band {
  const availableTop = viewport.headerPx + GUTTER_PX;
  const availableBottom = viewport.height - viewport.rulerPx - GUTTER_PX - CAPTION_BELOW_PX;

  const spreadTop = viewport.height * (AXIS_PCT - MAX_SPREAD_PCT);
  const spreadBottom = viewport.height * (AXIS_PCT + MAX_SPREAD_PCT);

  let topPx = Math.max(availableTop, spreadTop);
  let bottomPx = Math.min(availableBottom, spreadBottom);

  if (bottomPx - topPx < MIN_BAND_PX) {
    topPx = availableTop;
    bottomPx = availableBottom;
  }

  return { topPx, bottomPx: Math.max(topPx, bottomPx) };
}

export function yPx(star: PlacedStar, band: Band): number {
  return band.topPx + star.y01 * (band.bottomPx - band.topPx);
}

export interface Connector {
  readonly fromSlug: string;
  readonly toSlug: string;
  readonly x: number;
  readonly y: number;
  readonly lengthPx: number;
  readonly angleDeg: number;
}

export function connectors(stars: readonly PlacedStar[], band: Band): readonly Connector[] {
  const links: Connector[] = [];

  for (let i = 1; i < stars.length; i += 1) {
    const from = stars[i - 1];
    const to = stars[i];
    if (!from || !to) continue;

    const fromY = yPx(from, band);
    const dx = to.x - from.x;
    const dy = yPx(to, band) - fromY;

    links.push({
      fromSlug: from.slug,
      toSlug: to.slug,
      x: from.x,
      y: fromY,
      lengthPx: Math.hypot(dx, dy),
      angleDeg: (Math.atan2(dy, dx) * 180) / Math.PI,
    });
  }

  return links;
}

export function xAtTime(
  stars: readonly PlacedStar[],
  timestamp: number,
  config: TimelineConfig = TIMELINE,
): number {
  const first = stars[0];
  const last = stars[stars.length - 1];
  if (!first || !last) return config.originX;

  const perMs = config.gapPxPerDay / MS_PER_DAY;
  if (timestamp <= first.timestamp) return first.x - (first.timestamp - timestamp) * perMs;
  if (timestamp >= last.timestamp) return last.x + (timestamp - last.timestamp) * perMs;

  for (let i = 1; i < stars.length; i += 1) {
    const from = stars[i - 1];
    const to = stars[i];
    if (!from || !to || timestamp > to.timestamp) continue;

    const span = to.timestamp - from.timestamp;
    if (span === 0) return from.x;
    return from.x + ((timestamp - from.timestamp) / span) * (to.x - from.x);
  }

  return last.x;
}

export interface YearMarker {
  readonly year: number;
  readonly x: number;
}

export function yearMarkers(
  stars: readonly PlacedStar[],
  config: TimelineConfig = TIMELINE,
): readonly YearMarker[] {
  const first = stars[0];
  const last = stars[stars.length - 1];
  if (!first || !last) return [];

  const firstYear = new Date(first.timestamp).getUTCFullYear();
  const lastYear = new Date(last.timestamp).getUTCFullYear();

  const start = firstMonthStart(stars);
  const markers: YearMarker[] = [];
  for (let year = firstYear; year <= lastYear; year += 1) {
    markers.push({ year, x: xAtTime(stars, Math.max(start, Date.UTC(year, 0, 1)), config) });
  }
  return markers;
}

export interface MonthMarker {
  readonly key: string;
  readonly year: number;
  readonly month: number;
  readonly timestamp: number;
  readonly x: number;
  readonly january: boolean;
  readonly withYear: boolean;
  readonly hasPublication: boolean;
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

function firstMonthStart(stars: readonly PlacedStar[]): number {
  const first = new Date(stars[0]?.timestamp ?? 0);
  return Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1);
}

export function monthMarkers(
  stars: readonly PlacedStar[],
  config: TimelineConfig = TIMELINE,
): readonly MonthMarker[] {
  const first = stars[0];
  const last = stars[stars.length - 1];
  if (!first || !last) return [];

  const withPublication = new Set(
    stars.map((star) => {
      const date = new Date(star.timestamp);
      return monthKey(date.getUTCFullYear(), date.getUTCMonth());
    }),
  );

  const end = new Date(last.timestamp);
  const endIndex = end.getUTCFullYear() * 12 + end.getUTCMonth();
  const markers: MonthMarker[] = [];
  const start = new Date(first.timestamp);
  const startIndex = start.getUTCFullYear() * 12 + start.getUTCMonth();
  for (let index = startIndex; index <= endIndex; index += 1) {
    const year = Math.floor(index / 12);
    const month = index % 12;
    const timestamp = Date.UTC(year, month, 1);
    const key = monthKey(year, month);
    markers.push({
      key,
      year,
      month,
      timestamp,
      x: xAtTime(stars, timestamp, config),
      january: month === 0,
      withYear: month === 0 || index === startIndex,
      hasPublication: withPublication.has(key),
    });
  }
  return markers;
}

const MONTH_LABEL = { padPx: 8, charPx: 11, heightPx: 34 } as const;

const STAR_REACH_ABOVE_PX = 22;

const STAR_CAPTION_HALF_PX = 90;

const LABEL_CLEARANCE_PX = 8;

export function occludedMonths(
  markers: readonly MonthMarker[],
  stars: readonly PlacedStar[],
  band: Band,
  axisPx: number,
): ReadonlySet<string> {
  const hidden = new Set<string>();
  const labelTop = axisPx - LABEL_CLEARANCE_PX;
  const labelBottom = axisPx + MONTH_LABEL.heightPx + LABEL_CLEARANCE_PX;

  for (const marker of markers) {
    const chars = marker.withYear ? 8 : 3;
    const left = marker.x - LABEL_CLEARANCE_PX;
    const right = marker.x + MONTH_LABEL.padPx + chars * MONTH_LABEL.charPx + LABEL_CLEARANCE_PX;

    const covered = stars.some((star) => {
      const y = yPx(star, band);
      return (
        star.x + STAR_CAPTION_HALF_PX > left &&
        star.x - STAR_CAPTION_HALF_PX < right &&
        y + CAPTION_BELOW_PX > labelTop &&
        y - STAR_REACH_ABOVE_PX < labelBottom
      );
    });
    if (covered) hidden.add(marker.key);
  }
  return hidden;
}

export interface Extent {
  readonly minX: number;
  readonly maxX: number;
  readonly widthPx: number;
}

export function strandExtent(
  stars: readonly PlacedStar[],
  config: TimelineConfig = TIMELINE,
): Extent {
  const first = stars[0];
  const last = stars[stars.length - 1];
  if (!first || !last) return { minX: 0, maxX: 0, widthPx: 0 };

  const minX = first.x - config.originX;
  const maxX = last.x + config.trailingPadPx;
  return { minX, maxX, widthPx: maxX - minX };
}

export interface PanBounds {
  readonly min: number;
  readonly max: number;
}

export function panBounds(
  stars: readonly PlacedStar[],
  viewportWidth: number,
  config: TimelineConfig = TIMELINE,
): PanBounds {
  const extent = strandExtent(stars, config);
  const first = stars[0];
  const last = stars[stars.length - 1];
  if (first && last && extent.widthPx <= viewportWidth) {
    const centered = (first.x + last.x) / 2 - viewportWidth / 2;
    return { min: centered, max: centered };
  }
  const latestCentered = last ? last.x - viewportWidth / 2 : extent.minX;
  return {
    min: extent.minX,
    max: Math.max(extent.minX, extent.maxX - viewportWidth, latestCentered),
  };
}

export function homePan(
  stars: readonly PlacedStar[],
  viewportWidth: number,
  config: TimelineConfig = TIMELINE,
): number {
  const last = stars[stars.length - 1];
  if (!last) return 0;
  return panForStar(stars, last, viewportWidth, 0.5, config);
}

export function panForStar(
  stars: readonly PlacedStar[],
  star: PlacedStar,
  viewportWidth: number,
  bias = 0.42,
  config: TimelineConfig = TIMELINE,
): number {
  const bounds = panBounds(stars, viewportWidth, config);
  return Math.min(bounds.max, Math.max(bounds.min, star.x - viewportWidth * bias));
}

export function yearAtCenter(stars: readonly PlacedStar[], centerX: number): number | null {
  let nearest: PlacedStar | null = null;
  let distance = Infinity;

  for (const star of stars) {
    const candidate = Math.abs(star.x - centerX);
    if (candidate >= distance) continue;
    distance = candidate;
    nearest = star;
  }

  return nearest === null ? null : new Date(nearest.timestamp).getUTCFullYear();
}

export interface VisibleRange {
  readonly start: number;
  readonly end: number;
}

function lowerBound(xs: readonly number[], target: number): number {
  let low = 0;
  let high = xs.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if ((xs[mid] ?? 0) < target) low = mid + 1;
    else high = mid;
  }
  return low;
}

export function visibleRange(
  xs: readonly number[],
  pan: number,
  viewportWidth: number,
  marginPx: number,
): VisibleRange {
  const start = lowerBound(xs, pan - marginPx);
  const end = lowerBound(xs, pan + viewportWidth + marginPx + Number.MIN_VALUE);
  return { start, end: Math.max(start, end) };
}

export function panBucket(pan: number, bucketPx = 512): number {
  return Math.floor(pan / bucketPx);
}

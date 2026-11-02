import type { Locale, PublicationSummary } from './types';
import { isCategory } from './types';

export function snapshotPath(locale: Locale): string {
  return `/data/publications.${locale}.json`;
}

export function serializeSnapshot(items: readonly PublicationSummary[]): string {
  return JSON.stringify(items);
}

function optional(value: unknown, type: 'string' | 'boolean'): boolean {
  return value === undefined || typeof value === type;
}

function isSummary(value: unknown): value is PublicationSummary {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.slug === 'string' &&
    typeof row.publishedAt === 'string' &&
    !Number.isNaN(Date.parse(row.publishedAt)) &&
    isCategory(row.category) &&
    typeof row.title === 'string' &&
    typeof row.summary === 'string' &&
    optional(row.featured, 'boolean') &&
    optional(row.updatedAt, 'string') &&
    optional(row.indexable, 'boolean')
  );
}

export function parseSnapshot(value: unknown): readonly PublicationSummary[] | null {
  if (!Array.isArray(value)) return null;
  return value.every(isSummary) ? value : null;
}

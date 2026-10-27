/**
 * O acervo congelado no build.
 *
 * O prerender já busca a lista de cada idioma para o RSS e o índice; gravá-la
 * também como JSON dá ao cliente uma constelação que não depende da API para
 * aparecer. A API continua sendo a fonte da verdade: o snapshot só cobre o
 * intervalo até ela responder, ou a falta dela.
 *
 * Grava a forma do domínio (`PublicationSummary`), não a da API: quem lê é o
 * cliente, que nunca precisa saber como o Laravel escreve `published_at`.
 *
 * Módulo puro: sem DOM, sem React, sem Three.
 */

import type { Locale, PublicationSummary } from './types';
import { isCategory } from './types';

/** Raiz-relativo: o arquivo é servido pelo mesmo host que serve o HTML. */
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

/**
 * O snapshot inteiro, ou nada.
 *
 * Uma linha inválida descarta o arquivo todo em vez de só ela: uma constelação
 * com uma estrela a menos, sem aviso, é pior que esperar a API — que é o que
 * acontece quando isto devolve `null`.
 */
export function parseSnapshot(value: unknown): readonly PublicationSummary[] | null {
  if (!Array.isArray(value)) return null;
  return value.every(isSummary) ? value : null;
}

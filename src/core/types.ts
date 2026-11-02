export const LOCALES = ['pt', 'en'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'pt';

export const LOCALE_TAG: Record<Locale, string> = { pt: 'pt-BR', en: 'en-GB' };

export const OG_LOCALE: Record<Locale, string> = { pt: 'pt_BR', en: 'en_GB' };

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

export const CATEGORIES = ['artigo', 'projeto', 'estudo', 'rotina'] as const;

export type Category = (typeof CATEGORIES)[number];

export function isCategory(value: unknown): value is Category {
  return typeof value === 'string' && (CATEGORIES as readonly string[]).includes(value);
}

export interface PublicationInput {
  readonly slug: string;
  readonly publishedAt: string;
  readonly category: Category;
  readonly featured?: boolean;
  readonly updatedAt?: string;
  readonly indexable?: boolean;
}

export interface Viewport {
  readonly width: number;
  readonly height: number;
  readonly headerPx: number;
  readonly rulerPx: number;
}

export interface Band {
  readonly topPx: number;
  readonly bottomPx: number;
}

export interface PublicationContent {
  readonly title: string;
  readonly summary: string;
  readonly body: string;
}

export interface Publication extends PublicationInput {
  readonly content: Record<Locale, PublicationContent>;
}

export interface PublicationSummary extends PublicationInput {
  readonly title: string;
  readonly summary: string;
}

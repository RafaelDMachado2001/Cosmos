import { fnv1a32 } from './hash';
import type { Category, Locale } from './types';

export const OG_SIZE = { width: 1200, height: 630 } as const;

const OG_DESIGN = 4;

export interface OgCard {
  readonly locale: Locale;
  readonly title: string;
  readonly kicker: string;
  readonly category?: Category;
  readonly date?: string;
}

export function ogImagePath(card: OgCard): string {
  const drawn = JSON.stringify([
    OG_DESIGN,
    card.locale,
    card.kicker,
    card.title,
    card.category ?? '',
    card.date ?? '',
  ]);
  const hash = fnv1a32(drawn).toString(16).padStart(8, '0');
  return `/og/${card.locale}-${hash}.png`;
}

export function parseTokens(css: string): Readonly<Record<string, string>> {
  const tokens: Record<string, string> = {};
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const match of withoutComments.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
    const [, name, value] = match;
    if (name !== undefined && value !== undefined) tokens[name] = value.trim();
  }
  return tokens;
}

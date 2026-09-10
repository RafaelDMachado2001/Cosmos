export const LOCALES = ['pt', 'en'] as const;

export type Locale = (typeof LOCALES)[number];

export const CATEGORIES = ['artigo', 'projeto', 'estudo', 'rotina'] as const;

export type Category = (typeof CATEGORIES)[number];

export function isCategory(value: unknown): value is Category {
  return typeof value === 'string' && (CATEGORIES as readonly string[]).includes(value);
}

/** O mínimo que a constelação precisa para posicionar uma estrela. */
export interface PublicationInput {
  readonly slug: string;
  /** ISO 8601. Interpretado em UTC para não depender do fuso de quem lê. */
  readonly publishedAt: string;
  readonly category: Category;
  readonly featured?: boolean;
}

/** Medidas de tela de que o posicionamento precisa. */
export interface Viewport {
  readonly width: number;
  readonly height: number;
  /** Altura real do header, medida — não uma constante. */
  readonly headerPx: number;
  /** Altura reservada à régua temporal no rodapé. */
  readonly rulerPx: number;
}

/** Faixa vertical em que as estrelas podem cair, em px. */
export interface Band {
  readonly topPx: number;
  readonly bottomPx: number;
}

/** Corpo de uma publicação num idioma. */
export interface PublicationContent {
  readonly title: string;
  readonly summary: string;
  /** Parágrafos. Virá do PostgreSQL como HTML sanitizado quando o backend existir. */
  readonly body: readonly string[];
}

/** Uma publicação completa, bilíngue. */
export interface Publication extends PublicationInput {
  readonly content: Record<Locale, PublicationContent>;
}

/** A forma enxuta que a constelação consome — sem o corpo do texto. */
export interface PublicationSummary extends PublicationInput {
  readonly title: string;
  readonly summary: string;
}

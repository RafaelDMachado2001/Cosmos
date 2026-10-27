export const LOCALES = ['pt', 'en'] as const;

export type Locale = (typeof LOCALES)[number];

/**
 * O idioma servido a quem não escolheu.
 *
 * É também o alvo do `x-default` no `hreflang` e a casca gravada na raiz e no
 * `404.html` — os três são a mesma pergunta: em que língua falar com quem ainda
 * não disse a sua.
 */
export const DEFAULT_LOCALE: Locale = 'pt';

/** A etiqueta BCP-47 de cada idioma: o `lang` do documento e o `inLanguage` do JSON-LD. */
export const LOCALE_TAG: Record<Locale, string> = { pt: 'pt-BR', en: 'en-GB' };

/**
 * A mesma coisa na forma que o Open Graph exige.
 *
 * Ali o valor é sempre `idioma_TERRITÓRIO` — `en` sozinho é recusado — e o
 * território escolhido acompanha o que a formatação de data já usa.
 */
export const OG_LOCALE: Record<Locale, string> = { pt: 'pt_BR', en: 'en_GB' };

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

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
  /**
   * ISO 8601. Maior que `publishedAt` quando o texto foi editado depois de
   * publicado; ausente nas publicações que nunca viram o backend (acervo
   * semente, sintéticas) — `publishedAt` vale como a única data conhecida.
   */
  readonly updatedAt?: string;
  /**
   * Default `true`. `false` é o `indexable` do RDM Studio: sai do sitemap e
   * o `<head>` ganha `noindex` — a publicação continua no ar, só não entra
   * no índice de busca.
   */
  readonly indexable?: boolean;
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
  /**
   * Markdown cru, no subconjunto de `core/blocks.ts` — título, parágrafo,
   * citação, lista, código, imagem. Vem do PostgreSQL como um `text` só;
   * quem o divide em blocos é `parseBlocks`, não o servidor.
   */
  readonly body: string;
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

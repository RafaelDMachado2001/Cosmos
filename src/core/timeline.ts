/**
 * Posicionamento derivado da constelação.
 *
 * Nenhuma coordenada é armazenada: a posição de cada estrela é função pura da
 * data de publicação e de um hash do slug. Publicar um item novo o coloca na
 * constelação sozinho, sem nenhuma edição de layout.
 *
 * Módulo puro: sem DOM, sem React, sem Three.
 */

import { hash01 } from './hash';
import type { Category, PublicationInput } from './types';

// ---------------------------------------------------------------------------
// Configuração
// ---------------------------------------------------------------------------

export interface TimelineConfig {
  /** Origem do eixo. Constante: ancorar na primeira publicação faria um item
   *  retroativo re-originar o universo inteiro. */
  readonly epochISO: string;
  /** x da época, em px. */
  readonly originX: number;
  /** Escala do eixo. FIXA — ver a nota sobre adaptividade em suggestGapPxPerDay. */
  readonly gapPxPerDay: number;
  /** Distância mínima entre estrelas consecutivas. 32px do anel comum + 2. */
  readonly minGapPx: number;
  /** Folga à direita da última estrela, para a faixa não terminar no ponto. */
  readonly trailingPadPx: number;
}

export const TIMELINE: TimelineConfig = {
  epochISO: '2024-01-01',
  originX: 300,
  gapPxPerDay: 3.4,
  minGapPx: 34,
  trailingPadPx: 380,
};

export const MS_PER_DAY = 86400000;

export interface PlacedStar {
  readonly slug: string;
  /** ms desde a época Unix, UTC. */
  readonly timestamp: number;
  /** Posição cronológica no conjunto posicionado. */
  readonly index: number;
  /** x derivado só da data, antes do passe de espaçamento. */
  readonly dateX: number;
  /** x final, depois do passe. */
  readonly x: number;
  /** x - dateX. Zero marca um ponto de reset. */
  readonly pushPx: number;
  /** Altura relativa em [0, 1), invariante ao viewport. */
  readonly y01: number;
  readonly category: Category;
  readonly featured: boolean;
}

// ---------------------------------------------------------------------------
// Posicionamento horizontal
// ---------------------------------------------------------------------------

/** Dias fracionários desde a época, em UTC. Fracionário de propósito: assim
 *  publicações do mesmo dia ainda ordenam por hora, como fará o timestamptz. */
export function dayOffset(iso: string, epochISO: string = TIMELINE.epochISO): number {
  const epoch = Date.parse(`${epochISO}T00:00:00.000Z`);
  return (Date.parse(iso) - epoch) / MS_PER_DAY;
}

/** x derivado apenas da data. Pode ser negativo: publicações anteriores à
 *  época são legais, e quem lida com isso são os limites de pan. */
export function dateX(iso: string, config: TimelineConfig = TIMELINE): number {
  return config.originX + dayOffset(iso, config.epochISO) * config.gapPxPerDay;
}

/**
 * Posiciona as estrelas resolvendo sobreposição sem sacrificar a estabilidade.
 *
 *   x[i] = max(dateX[i], x[i-1] + minGapPx)
 *
 * É a recorrência de Lindley, e dela decorre a garantia central do handoff:
 * como x[i] só depende de índices menores, **acrescentar o item mais novo não
 * move nenhum existente**. Onde `pushPx === 0` há um ponto de reset: dali para
 * a direita nada à esquerda importa mais.
 *
 * O que se abre mão: publicar algo retroativo pode empurrar alguns vizinhos
 * para a direita, e só até o próximo reset. O passe espelhado seria estável no
 * prepend e instável no append — e o append é o caso real.
 */
export function placeStars(
  items: readonly PublicationInput[],
  config: TimelineConfig = TIMELINE,
): readonly PlacedStar[] {
  const sorted = [...items].sort((a, b) => {
    const byTime = Date.parse(a.publishedAt) - Date.parse(b.publishedAt);
    // Desempate por slug: sem ordem total o passe dependeria da ordem de entrada.
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

// ---------------------------------------------------------------------------
// Diagnóstico do layout
// ---------------------------------------------------------------------------

export interface LayoutHealth {
  readonly widthPx: number;
  readonly minSpacingPx: number;
  readonly medianSpacingPx: number;
  readonly pushedCount: number;
  readonly pushedRatio: number;
}

/**
 * Métricas do conjunto posicionado. Existe para ser asserido em teste contra o
 * acervo real: quando `pushedRatio` sobe, é sinal de que `gapPxPerDay` ficou
 * apertado e precisa subir — num commit explícito, nunca sozinho.
 */
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

/**
 * Escala que o acervo pediria para respirar. **Consultiva**: nunca alimenta
 * placeStars.
 *
 * Derivar o gap do conjunto em tempo de execução é incompatível com "publicar
 * não move ninguém" — a cada publicação o gap mudaria e a constelação inteira
 * se deslocaria. Também quebraria a paginação, porque o mesmo slug cairia em x
 * diferente na página 1 e na página 2. Então a adaptividade vive aqui, como
 * recomendação lida por um teste, e o valor efetivo é fixado em TIMELINE.
 */
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

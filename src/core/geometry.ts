/**
 * A geometria da constelacao: faixa vertical, conectores, eixo do tempo, limites
 * de pan e janela visivel.
 *
 * Tudo aqui parte de estrelas ja colocadas por `placeStars`; nada decide onde
 * uma estrela fica, so como o resto da cena se arranja em volta dela.
 *
 * Modulo puro: sem DOM, sem React, sem Three.
 */

import { MS_PER_DAY, TIMELINE } from './timeline';
import type { PlacedStar, TimelineConfig } from './timeline';
import type { Band, Viewport } from './types';

/** Altura do eixo do tempo, em fração da viewport. O protótipo usa 58%. */
export const AXIS_PCT = 0.58;

/** Dispersão máxima para cada lado do eixo. Sem o limite, uma tela alta
 *  espalharia as estrelas por toda ela e a constelação deixaria de se ler
 *  como uma faixa. */
const MAX_SPREAD_PCT = 0.25;

/** Abaixo disto não vale a pena limitar: usa-se o espaço que houver. */
const MIN_BAND_PX = 120;

const GUTTER_PX = 24;

/**
 * Faixa vertical disponível para as estrelas.
 *
 * A altura relativa de cada estrela (`y01`) é pura e invariante ao viewport;
 * quem depende da tela é a faixa. Essa separação é o que conserta as duas
 * colisões do protótipo — a faixa fixa de 30–80% cobria a régua em telas
 * baixas e sentava sobre os marcadores de ano — sem sacrificar estabilidade.
 */
export function resolveBand(viewport: Viewport): Band {
  const availableTop = viewport.headerPx + GUTTER_PX;
  const availableBottom = viewport.height - viewport.rulerPx - GUTTER_PX;

  const spreadTop = viewport.height * (AXIS_PCT - MAX_SPREAD_PCT);
  const spreadBottom = viewport.height * (AXIS_PCT + MAX_SPREAD_PCT);

  let topPx = Math.max(availableTop, spreadTop);
  let bottomPx = Math.min(availableBottom, spreadBottom);

  if (bottomPx - topPx < MIN_BAND_PX) {
    // Tela apertada: o espaço disponível é o máximo que dá, sem limitar.
    topPx = availableTop;
    bottomPx = availableBottom;
  }

  return { topPx, bottomPx: Math.max(topPx, bottomPx) };
}

/** Resolve a altura relativa da estrela em pixels dentro da faixa. */
export function yPx(star: PlacedStar, band: Band): number {
  return band.topPx + star.y01 * (band.bottomPx - band.topPx);
}

// ---------------------------------------------------------------------------
// Conectores
// ---------------------------------------------------------------------------

export interface Connector {
  readonly fromSlug: string;
  readonly toSlug: string;
  /** Origem do segmento; usar com transform-origin 0 0. */
  readonly x: number;
  readonly y: number;
  readonly lengthPx: number;
  readonly angleDeg: number;
}

/**
 * Segmentos entre estrelas consecutivas, em pixels reais.
 *
 * O protótipo aproximava a diferença vertical como `dyPct * 6`, o que só vale
 * num viewport de 600px de altura — em qualquer outra o ângulo saía errado.
 */
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

// ---------------------------------------------------------------------------
// Eixo do tempo
// ---------------------------------------------------------------------------

/**
 * Mapeia um instante para o espaço JÁ empurrado, interpolando entre as
 * estrelas vizinhas. Fora das pontas, extrapola pela escala nominal.
 *
 * Os marcadores de ano passam por aqui em vez de por `dateX`: numa região
 * comprimida pelo passe de espaçamento, o rótulo se descolaria das estrelas.
 */
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
    // Empate de datas: as duas estrelas ficam no mesmo instante, então não há
    // o que interpolar — vale a primeira.
    if (span === 0) return from.x;
    return from.x + ((timestamp - from.timestamp) / span) * (to.x - from.x);
  }

  return last.x;
}

export interface YearMarker {
  readonly year: number;
  readonly x: number;
}

/** Marcadores derivados do intervalo real do acervo. */
export function yearMarkers(
  stars: readonly PlacedStar[],
  config: TimelineConfig = TIMELINE,
): readonly YearMarker[] {
  const first = stars[0];
  const last = stars[stars.length - 1];
  if (!first || !last) return [];

  const firstYear = new Date(first.timestamp).getUTCFullYear();
  const lastYear = new Date(last.timestamp).getUTCFullYear();

  const markers: YearMarker[] = [];
  for (let year = firstYear; year <= lastYear; year += 1) {
    markers.push({ year, x: xAtTime(stars, Date.UTC(year, 0, 1), config) });
  }
  return markers;
}

export interface MonthMarker {
  /** `2024-03`: chave estável para o React e para casar com as publicações. */
  readonly key: string;
  readonly year: number;
  /** 0 a 11, como em `Date.UTC`. */
  readonly month: number;
  readonly timestamp: number;
  readonly x: number;
  /** Janeiro carrega o ano no rótulo e um filete mais forte. */
  readonly january: boolean;
  /** Meses com publicação ganham destaque; os vazios ficam apagados. */
  readonly hasPublication: boolean;
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

/**
 * Um marcador por mês, de janeiro do primeiro ano até o mês da publicação mais
 * recente. Começa em janeiro, e não no primeiro mês com dados, para que o ano
 * inicial também tenha o seu rótulo `JAN 2024` no eixo.
 */
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
  for (let index = new Date(first.timestamp).getUTCFullYear() * 12; index <= endIndex; index += 1) {
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
      hasPublication: withPublication.has(key),
    });
  }
  return markers;
}

// ---------------------------------------------------------------------------
// Extensão da faixa e limites de pan
// ---------------------------------------------------------------------------

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

  // Publicações anteriores à época têm x negativo: a faixa acompanha.
  const minX = Math.min(0, first.x - config.originX);
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
  return { min: extent.minX, max: Math.max(extent.minX, extent.maxX - viewportWidth) };
}

/** Pan que traz a estrela para `bias` da largura da viewport. */
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

/**
 * O ano da estrela mais próxima de um ponto da linha do tempo.
 *
 * É o que a régua anuncia como `aria-valuetext`: um `slider` que só diz "37%"
 * não informa nada sobre um acervo temporal — quem navega por ele quer saber
 * em que ano está, que é exatamente o que os marcadores mostram a quem vê.
 */
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

// ---------------------------------------------------------------------------
// Virtualização
// ---------------------------------------------------------------------------

export interface VisibleRange {
  readonly start: number;
  /** Exclusivo, para servir direto a `slice`. */
  readonly end: number;
}

/** Menor índice cujo x é >= alvo. Busca binária: O(log n) por frame-gate. */
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

/**
 * Janela de estrelas dentro da viewport mais a margem. `xs` precisa estar
 * ordenado — é a ordem que `placeStars` já devolve.
 */
export function visibleRange(
  xs: readonly number[],
  pan: number,
  viewportWidth: number,
  marginPx: number,
): VisibleRange {
  const start = lowerBound(xs, pan - marginPx);
  // upperBound do limite direito: primeiro índice estritamente maior.
  const end = lowerBound(xs, pan + viewportWidth + marginPx + Number.MIN_VALUE);
  return { start, end: Math.max(start, end) };
}

/**
 * Faixa de pan em que a janela de virtualização não precisa mudar.
 *
 * O pan é escrito direto no DOM a cada frame; só a mudança de bucket vira
 * setState. Com margem de 1.5 viewport e bucket de 512px, a janela está sempre
 * pelo menos uma tela à frente do gate, então nada aparece visivelmente.
 */
export function panBucket(pan: number, bucketPx = 512): number {
  return Math.floor(pan / bucketPx);
}

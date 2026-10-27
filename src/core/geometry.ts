/**
 * A geometria da constelação: faixa vertical, conectores, eixo do tempo, limites
 * de pan e janela visível.
 *
 * Tudo aqui parte de estrelas já colocadas por `placeStars`; nada decide onde
 * uma estrela fica, só como o resto da cena se arranja em volta dela.
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
 * O rótulo pende sob a estrela: metade do núcleo em destaque (22) + 22 de
 * folga + duas linhas de título e a data (~58). Sem esta reserva, a estrela
 * mais baixa da faixa assentava o rótulo em cima da régua.
 */
export const CAPTION_BELOW_PX = 102;

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
  const availableBottom = viewport.height - viewport.rulerPx - GUTTER_PX - CAPTION_BELOW_PX;

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

  // O ano inicial âncora no mês da primeira publicação, não em janeiro: um
  // acervo que começa em outubro não pode abrir com nove meses de vazio.
  const start = firstMonthStart(stars);
  const markers: YearMarker[] = [];
  for (let year = firstYear; year <= lastYear; year += 1) {
    markers.push({ year, x: xAtTime(stars, Math.max(start, Date.UTC(year, 0, 1)), config) });
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
  /** Janeiro tem um filete mais forte. */
  readonly january: boolean;
  /** Janeiro e o primeiro marcador carregam o ano no rótulo. */
  readonly withYear: boolean;
  /** Meses com publicação ganham destaque; os vazios ficam apagados. */
  readonly hasPublication: boolean;
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

/** O instante em que começa o mês (UTC) da publicação mais antiga. */
function firstMonthStart(stars: readonly PlacedStar[]): number {
  const first = new Date(stars[0]?.timestamp ?? 0);
  return Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1);
}

/**
 * Um marcador por mês, do mês da publicação mais antiga até o da mais
 * recente. Começar em janeiro deixava meses vazios antes da primeira estrela —
 * e, depois de apagar os anos mais antigos, um ano inteiro. O primeiro
 * marcador carrega o ano (`OUT 2026`) para o eixo nunca abrir sem ele.
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

/**
 * A caixa do rótulo de mês, em mono de 11px com `--tracking-meta` (0.22em):
 * 0.6em de avanço + 0.22em de tracking dá ~9px por caractere, mais os 8px de
 * recuo do filete. A altura cobre o recuo de janeiro (16px) e a linha.
 */
const MONTH_LABEL = { padPx: 8, charPx: 9, heightPx: 32 } as const;

/** Até onde a estrela chega acima do centro: metade do núcleo em destaque. */
const STAR_REACH_ABOVE_PX = 22;

/** Meia largura do rótulo da estrela (`--star-label-width` de 180px). */
const STAR_CAPTION_HALF_PX = 90;

/** Folga entre o rótulo de mês e o de uma estrela. */
const LABEL_CLEARANCE_PX = 8;

/**
 * Os meses cujo rótulo cairia sob uma estrela ou sob o rótulo dela.
 *
 * A estrela perto do eixo desenhava a própria data (`OUT 2026`) em cima da do
 * mês, que diz o mesmo. Quem cede é o mês: o filete continua, só o texto some,
 * e a data da estrela já cobre aquele trecho do eixo.
 */
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

  // A faixa começa na primeira estrela, não na época: a época é fixa (é o que
  // impede um item retroativo de mover os demais), mas apagar as publicações
  // mais antigas não pode deixar o pan inicial num trecho vazio do eixo.
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
  // Acervo que cabe inteiro na tela: as estrelas ficam no centro, sem pan.
  // Ancorar na borda esquerda deixava metade da tela vazia à direita.
  if (first && last && extent.widthPx <= viewportWidth) {
    const centered = (first.x + last.x) / 2 - viewportWidth / 2;
    return { min: centered, max: centered };
  }
  // O limite direito alcança a última estrela no centro da tela, que é onde a
  // constelação abre (`homePan`); só a folga de `trailingPadPx` não bastava
  // numa tela mais larga que o dobro dela.
  const latestCentered = last ? last.x - viewportWidth / 2 : extent.minX;
  return {
    min: extent.minX,
    max: Math.max(extent.minX, extent.maxX - viewportWidth, latestCentered),
  };
}

/**
 * Onde a constelação abre: a publicação mais recente no centro da tela.
 *
 * Abrir na mais antiga deixava a chegada no passado, com o marcador da régua
 * colado em PASSADO e o que acabou de sair a telas de distância.
 */
export function homePan(
  stars: readonly PlacedStar[],
  viewportWidth: number,
  config: TimelineConfig = TIMELINE,
): number {
  const last = stars[stars.length - 1];
  if (!last) return 0;
  return panForStar(stars, last, viewportWidth, 0.5, config);
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

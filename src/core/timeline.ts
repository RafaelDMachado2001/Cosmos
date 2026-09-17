/**
 * Posicionamento derivado da constelação.
 *
 * Nenhuma coordenada é armazenada: a posição de cada estrela é função pura da
 * data de publicação e de um hash do slug. Publicar um item novo o coloca na
 * constelação sozinho, sem nenhuma edição de layout.
 *
 * Módulo puro: sem DOM, sem React, sem Three.
 */

import type { Band, Category, PublicationInput, Viewport } from './types';

export const FNV_OFFSET_BASIS = 2166136261; // 0x811c9dc5
export const FNV_PRIME = 16777619; // 0x01000193

const encoder = new TextEncoder();

/**
 * FNV-1a de 32 bits sobre os BYTES UTF-8 da entrada.
 *
 * A codificação é parte do contrato, não um detalhe: o protótipo usava
 * `charCodeAt` (code units UTF-16) e o PHP percorre bytes UTF-8. Os dois
 * divergem em qualquer entrada acentuada, e as estrelas mudariam de altura no
 * dia em que o backend assumisse o cálculo. Ao portar para PHP, lembrar do
 * clamp: `$h = ($h ^ $byte) * FNV_PRIME & 0xFFFFFFFF;` — sem ele a
 * multiplicação vira float acima de 2^53.
 */
export function fnv1a32(input: string): number {
  let hash = FNV_OFFSET_BASIS;
  for (const byte of encoder.encode(input)) {
    hash ^= byte;
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

/**
 * Normaliza o hash para [0, 1) em 10.000 passos.
 *
 * A quantização vem do protótipo e é mantida de propósito: é a forma mais
 * barata de reproduzir em PHP. Com 10.000 valores distintos, algumas centenas
 * de publicações produzem alguns pares de mesma altura — inofensivo, já que
 * precisariam também ser vizinhas no eixo do tempo para se notar.
 */
export function hash01(input: string): number {
  return (fnv1a32(input) % 10000) / 10000;
}

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

const MS_PER_DAY = 86400000;

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

// ---------------------------------------------------------------------------
// Posicionamento vertical
// ---------------------------------------------------------------------------

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

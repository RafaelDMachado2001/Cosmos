/**
 * Enquadramento responsivo do núcleo.
 *
 * O núcleo ocupa a faixa livre entre o rodapé do header e o topo do bloco de
 * texto. Tudo é recalculado a cada medida, nunca fixo — e a medida vem do DOM
 * real (`getBoundingClientRect`), não de constantes: o protótipo teve dois
 * bugs justamente por assumir posições.
 *
 * Módulo puro: recebe números, devolve números. Quem mede é o chamador.
 */

export const CAMERA_FOV_DEG = 48;
export const CAMERA_BASE_Z = 4.3;

/** Folga entre o header e o topo da banda. */
const HEADER_GAP_PX = 14;
/** Folga entre a base da banda e o bloco de texto. */
const TEXT_GAP_PX = 24;

/** Abaixo disto a banda não encolhe mais, mesmo que o texto suba. */
export const MIN_BAND_PX = 120;

/** Piso da escala: o núcleo nunca some, por mais apertada que esteja a tela. */
export const MIN_BASE_SCALE = 0.22;

/** Reserva para o pico de deformação do shader não estourar a banda. */
const DEFORMATION_HEADROOM = 0.88;

/** Fração da largura que o núcleo pode ocupar em telas estreitas. */
const MAX_WIDTH_FRACTION = 0.28;

export interface FramingInput {
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  /** Altura real do header, medida. */
  readonly headerHeightPx: number;
  /** Topo do bloco de texto do hero, por getBoundingClientRect. */
  readonly textBlockTopPx: number;
}

export interface Framing {
  /** Escala do grupo do núcleo. */
  readonly baseScale: number;
  /** Deslocamento vertical em unidades de mundo. Positivo é acima do centro. */
  readonly baseY: number;
  readonly bandTopPx: number;
  readonly bandBottomPx: number;
}

/** Altura do frustum a uma dada distância da câmera. */
export function visibleHeight(z: number, fovDeg: number): number {
  return 2 * z * Math.tan((fovDeg * Math.PI) / 360);
}

/**
 * Calcula o enquadramento, ou devolve `null` se a medida não for utilizável.
 *
 * Devolver `null` em vez de improvisar é o coração da correção: no primeiro
 * mount `window.innerWidth/Height` podem ser 0, e qualquer conta feita ali
 * produz um NaN que gruda na cena para sempre. O chamador trata o `null` como
 * "medir de novo", não como "usar um padrão".
 */
export function computeFraming(input: FramingInput): Framing | null {
  const { viewportWidth, viewportHeight, headerHeightPx, textBlockTopPx } = input;

  const measurements = [viewportWidth, viewportHeight, headerHeightPx, textBlockTopPx];
  if (measurements.some((value) => !Number.isFinite(value))) return null;
  if (viewportWidth <= 0 || viewportHeight <= 0) return null;

  const bandTopPx = headerHeightPx + HEADER_GAP_PX;
  const band = Math.max(MIN_BAND_PX, textBlockTopPx - TEXT_GAP_PX - bandTopPx);
  const bandBottomPx = bandTopPx + band;
  const centerY = bandTopPx + band / 2;

  const radius = Math.min(
    (band / 2) * DEFORMATION_HEADROOM,
    viewportWidth * MAX_WIDTH_FRACTION,
  );

  const visH = visibleHeight(CAMERA_BASE_Z, CAMERA_FOV_DEG);

  return {
    baseScale: Math.max(MIN_BASE_SCALE, (radius * visH) / (viewportHeight * 1.06)),
    baseY: ((viewportHeight / 2 - centerY) / viewportHeight) * visH,
    bandTopPx,
    bandBottomPx,
  };
}

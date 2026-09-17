/**
 * A vista de leitura: fases da abertura e o que ela precisa decidir.
 *
 * A abertura tem três tempos — centralizar, avançar a câmera, montar o texto —
 * e o que os separa é tempo, não evento de usuário. Uma fase explícita evita o
 * defeito clássico dessa sequência: o `setTimeout` da montagem disparando
 * depois de a pessoa já ter fechado, remontando a vista sozinho.
 *
 * O `originPan` existe porque o handoff exige que a câmera recue "exatamente
 * para o ponto de onde saiu": abrir reposiciona o pan para centralizar a
 * estrela, e só quem guardou o valor anterior sabe voltar.
 *
 * Módulo puro: sem DOM, sem React, sem Three.
 */

import type { PlacedStar } from './timeline';

export type ReaderPhase = 'closed' | 'opening' | 'open' | 'closing';

export interface ReaderState {
  readonly phase: ReaderPhase;
  readonly slug: string | null;
  /** Pan de antes da abertura, devolvido no fechamento. */
  readonly originPan: number | null;
}

export const CLOSED: ReaderState = { phase: 'closed', slug: null, originPan: null };

/**
 * Inicia a abertura.
 *
 * Com algo já aberto é ruído: o overlay cobre a constelação, não há de onde
 * clicar outra estrela. Sobrescrever o `originPan` aqui devolveria a câmera ao
 * lugar errado no fechamento.
 */
export function open(state: ReaderState, slug: string, originPan: number): ReaderState {
  if (state.phase === 'opening' || state.phase === 'open') return state;
  return { phase: 'opening', slug, originPan };
}

/**
 * A vista que nasce aberta, numa chegada direta pela URL.
 *
 * Quem abre `/pt/publicacoes/{slug}` não pediu a travessia do portal nem o
 * avanço da câmera: pediu o artigo. Os três tempos da abertura contam uma
 * história de origem — *esta* estrela, vinda *dali* — e não há origem nenhuma
 * numa chegada direta. Por isso o `originPan` é `null`: fechar não recua para
 * lugar algum, apenas desfaz o zoom e deixa a constelação sobre a estrela lida.
 */
export function landed(state: ReaderState, slug: string): ReaderState {
  if (state.phase === 'opening' || state.phase === 'open') return state;
  return { phase: 'open', slug, originPan: null };
}

/** Passados os 760ms de avanço da câmera, a vista entra. */
export function mounted(state: ReaderState): ReaderState {
  if (state.phase !== 'opening') return state;
  return { ...state, phase: 'open' };
}

/**
 * Fechar por "×", pelo botão do fim do artigo ou por Esc.
 *
 * Fechar durante a abertura volta direto ao repouso: nesses 760ms a vista
 * ainda não existe no DOM, e uma fase de saída ali seria um estado que nada
 * consome. Quem chamou ainda tem o `originPan` do estado anterior para devolver
 * a câmera.
 */
export function close(state: ReaderState): ReaderState {
  if (state.phase === 'closed' || state.phase === 'closing') return state;
  if (state.phase === 'opening') return CLOSED;
  return { ...state, phase: 'closing' };
}

/** Fim do fade de saída: só aqui a vista sai do DOM. */
export function settled(state: ReaderState): ReaderState {
  if (state.phase !== 'closing') return state;
  return CLOSED;
}

/**
 * Se a vista está no DOM.
 *
 * Durante `opening` ainda não: são os 760ms em que só a constelação se afasta.
 * Durante `closing` continua, senão o fade de saída não teria o que desvanecer.
 */
export function isMounted(state: ReaderState): boolean {
  return state.phase === 'open' || state.phase === 'closing';
}

/** Alvo do zoom por quadro: a constelação se afasta ao abrir e volta ao fechar. */
export function zoomTarget(state: ReaderState): number {
  return state.phase === 'opening' || state.phase === 'open' ? 1 : 0;
}

/** Abaixo desta distância da borda direita o cartão de hover inverte de lado. */
export const HOVER_FLIP_PX = 360;

export type HoverSide = 'left' | 'right';

/** De que lado da estrela o cartão de hover cabe, dado o x já em tela. */
export function hoverSide(screenX: number, viewportWidth: number): HoverSide {
  return viewportWidth - screenX < HOVER_FLIP_PX ? 'left' : 'right';
}

export interface TimelinePosition {
  /** Contada a partir da mais antiga, que é a estrela mais à esquerda. */
  readonly position: number;
  readonly total: number;
}

/** O `3 / 14` exibido ao lado da data na vista de leitura. */
export function timelinePosition(
  slug: string,
  stars: readonly PlacedStar[],
): TimelinePosition | null {
  const star = stars.find((item) => item.slug === slug);
  if (!star) return null;
  return { position: star.index + 1, total: stars.length };
}

// ---------------------------------------------------------------------------
// Geometria do avanço da câmera
// ---------------------------------------------------------------------------

/** Quanto a constelação cresce enquanto a vista de leitura avança. */
export const ZOOM_SCALE = 1.35;

/** Desfoque máximo da constelação ao fundo, em px. */
export const ZOOM_BLUR_PX = 3;

/** A opacidade cai para 28%: 1 - 0.72. */
export const ZOOM_DIM = 0.72;

/** Abaixo desta largura a vista empilha e a estrela vira faixa hero. */
export const READER_MOBILE_MAX_PX = 780;

/** Abaixo disto o fade de saída acabou e a vista pode sair do DOM. */
export const SETTLE_BELOW = 0.02;

/**
 * Onde a estrela precisa parar quando a vista abre.
 *
 * No desktop a coluna da estrela ocupa os primeiros 25% da tela, então o alvo
 * é o centro dela. No mobile não há coluna: a faixa hero é a largura inteira.
 */
export function asideCenterX(viewportWidth: number): number {
  return viewportWidth * (viewportWidth < READER_MOBILE_MAX_PX ? 0.5 : 0.125);
}

/**
 * Deslocamento que leva a estrela do ponto onde está até a coluna da vista.
 *
 * Sem ele a constelação cresceria em torno da estrela e a deixaria no meio da
 * tela, atrás do texto. É proporcional ao zoom para que o avanço da câmera e o
 * deslize lateral sejam lidos como um movimento só.
 */
export function zoomPush(focusX: number, viewportWidth: number, zoom: number): number {
  return zoom * (focusX - asideCenterX(viewportWidth));
}

export function zoomScale(zoom: number): number {
  return 1 + zoom * ZOOM_SCALE;
}

export function zoomBlurPx(zoom: number): number {
  return zoom * ZOOM_BLUR_PX;
}

/** Fator aplicado à opacidade da constelação enquanto a vista avança. */
export function zoomDim(zoom: number): number {
  return 1 - zoom * ZOOM_DIM;
}

/** O `3 / 14  ·  MAI 2025` que a coluna da estrela mostra. */
export function timelineLabel(position: TimelinePosition, dateLabel: string): string {
  return `${position.position} / ${position.total}  ·  ${dateLabel}`;
}

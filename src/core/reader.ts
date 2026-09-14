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

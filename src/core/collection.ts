/**
 * O acervo enquanto ele carrega.
 *
 * A separação existe porque "nenhuma estrela na tela" tem três causas que
 * pedem telas diferentes: os dados ainda não chegaram, o carregamento falhou,
 * ou a busca simplesmente não encontrou nada. Tratar as três como uma só é o
 * defeito clássico — o leitor vê "nada encontrado" quando na verdade a rede
 * caiu, e não tem o que fazer a respeito.
 *
 * Estado discreto, e portanto do React: nada aqui muda por quadro.
 *
 * Módulo puro: sem DOM, sem React, sem Three.
 */

export type CollectionStatus = 'loading' | 'ready' | 'error';

export interface CollectionState<T> {
  readonly status: CollectionStatus;
  readonly items: readonly T[];
  /**
   * Muda a cada tentativa. É o que o efeito de carregamento observa para
   * disparar de novo: sem ele, o "loading" que vem de tentar outra vez seria
   * indistinguível do "loading" que precedeu a falha, e o efeito não rodaria.
   */
  readonly attempt: number;
}

export function loading<T>(): CollectionState<T> {
  return { status: 'loading', items: [], attempt: 0 };
}

export function loaded<T>(
  state: CollectionState<T>,
  items: readonly T[],
): CollectionState<T> {
  return { ...state, status: 'ready', items };
}

/**
 * A falha descarta o acervo anterior.
 *
 * Deixar as estrelas velhas na tela ao lado da mensagem de erro afirmaria que
 * aquilo é o acervo, quando é só o que sobrou da tentativa anterior.
 */
export function failed<T>(state: CollectionState<T>): CollectionState<T> {
  return { ...state, status: 'error', items: [] };
}

/** Só há o que repetir depois de uma falha. */
export function retry<T>(state: CollectionState<T>): CollectionState<T> {
  if (state.status !== 'error') return state;
  return { status: 'loading', items: [], attempt: state.attempt + 1 };
}

// ---------------------------------------------------------------------------
// Entrada escalonada
// ---------------------------------------------------------------------------

/** Passo entre uma estrela e a seguinte no fade de entrada, em ms. */
export const REVEAL_STEP_MS = 40;

/**
 * Teto do escalonamento.
 *
 * Sem ele um acervo grande transformaria a entrada em espera: a estrela de
 * índice 300 só apareceria doze segundos depois da primeira.
 */
export const REVEAL_MAX_MS = 900;

/** Atraso do fade de entrada de uma estrela, pela posição cronológica dela. */
export function revealDelayMs(index: number, reducedMotion = false): number {
  if (reducedMotion) return 0;
  return Math.min(Math.max(0, index) * REVEAL_STEP_MS, REVEAL_MAX_MS);
}

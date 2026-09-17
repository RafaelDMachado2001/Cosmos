import { describe, expect, it } from 'vitest';

import {
  REVEAL_MAX_MS,
  REVEAL_STEP_MS,
  failed,
  loaded,
  loading,
  retry,
  revealDelayMs,
} from './collection';

const ITEMS = ['a', 'b', 'c'];

describe('estados do acervo', () => {
  it('começa carregando, sem itens e na primeira tentativa', () => {
    expect(loading<string>()).toEqual({ status: 'loading', items: [], attempt: 0 });
  });

  it('carregar guarda os itens e encerra a espera', () => {
    const state = loaded(loading<string>(), ITEMS);
    expect(state.status).toBe('ready');
    expect(state.items).toEqual(ITEMS);
  });

  it('um acervo vazio é um carregamento bem-sucedido, não um erro', () => {
    expect(loaded(loading<string>(), []).status).toBe('ready');
  });

  it('a falha descarta o que havia antes', () => {
    const state = failed(loaded(loading<string>(), ITEMS));
    expect(state.status).toBe('error');
    expect(state.items).toEqual([]);
  });

  it('tentar de novo volta a carregar e conta a tentativa', () => {
    const state = retry(failed(loading<string>()));
    expect(state.status).toBe('loading');
    expect(state.attempt).toBe(1);
  });

  it('as tentativas se acumulam', () => {
    const state = retry(failed(retry(failed(loading<string>()))));
    expect(state.attempt).toBe(2);
  });

  it('só há o que repetir depois de uma falha', () => {
    const carregando = loading<string>();
    expect(retry(carregando)).toBe(carregando);

    const pronto = loaded(carregando, ITEMS);
    expect(retry(pronto)).toBe(pronto);
  });

  it('a contagem de tentativas sobrevive a um carregamento bem-sucedido', () => {
    const state = loaded(retry(failed(loading<string>())), ITEMS);
    expect(state.attempt).toBe(1);
  });
});

describe('revealDelayMs', () => {
  it('a primeira estrela não espera', () => {
    expect(revealDelayMs(0)).toBe(0);
  });

  it('cada estrela entra um passo depois da anterior', () => {
    expect(revealDelayMs(3)).toBe(3 * REVEAL_STEP_MS);
  });

  it('um acervo grande não vira espera', () => {
    expect(revealDelayMs(10_000)).toBe(REVEAL_MAX_MS);
  });

  it('com movimento reduzido todas entram juntas', () => {
    expect(revealDelayMs(7, true)).toBe(0);
  });

  it('índice negativo não produz atraso negativo', () => {
    expect(revealDelayMs(-1)).toBe(0);
  });
});

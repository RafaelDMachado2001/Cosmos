/**
 * Uma requisição que não espera para sempre.
 *
 * O Cloud Run escala a zero e o Neon suspende: a primeira chamada depois de um
 * tempo parado leva de 15 a 27 s, ou volta 503. Sem teto, a constelação ficava
 * esse tempo todo em "Mapeando o cosmos". Com ele, a tentativa que estoura o
 * prazo é abandonada e a seguinte costuma encontrar a instância já acordada.
 *
 * Só se repete o que pode dar certo da próxima vez: rede, prazo e 5xx. Um 4xx
 * é resposta — o slug não existe, o pedido está errado — e volta na primeira.
 */

export interface RetryPolicy {
  /** Teto de cada tentativa, até os cabeçalhos chegarem. */
  readonly timeoutMs: number;
  /** A espera antes de cada nova tentativa; o tamanho é o número delas. */
  readonly delaysMs: readonly number[];
  /** Injetável para os testes não esperarem segundos de verdade. */
  readonly sleep: (ms: number) => Promise<void>;
}

export const DEFAULT_RETRY: RetryPolicy = {
  timeoutMs: 8000,
  delaysMs: [1000, 3000],
  sleep: (ms) =>
    new Promise((resolve) => {
      setTimeout(resolve, ms);
    }),
};

async function attempt(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Devolve a primeira resposta abaixo de 500, ou a última 5xx quando as
 * tentativas acabam — o status é de quem chama interpretar. Erro de rede ou
 * de prazo na última tentativa é relançado.
 */
export async function fetchWithRetry(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  policy: RetryPolicy = DEFAULT_RETRY,
): Promise<Response> {
  for (let tries = 0; ; tries += 1) {
    let failure: { response: Response } | { error: unknown };
    try {
      const response = await attempt(fetchImpl, url, init, policy.timeoutMs);
      if (response.status < 500) return response;
      failure = { response };
    } catch (error) {
      failure = { error };
    }

    const delay = policy.delaysMs[tries];
    if (delay === undefined) {
      if ('response' in failure) return failure.response;
      throw failure.error;
    }
    await policy.sleep(delay);
  }
}

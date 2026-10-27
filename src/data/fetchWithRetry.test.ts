import { afterEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_RETRY, fetchWithRetry } from './fetchWithRetry';
import type { RetryPolicy } from './fetchWithRetry';

function reply(status: number): Response {
  return { ok: status >= 200 && status < 300, status } as Response;
}

/** Responde em sequência, um item por chamada; `Error` vira rejeição. */
function scripted(steps: readonly (number | Error)[]) {
  let calls = 0;
  const impl = (): Promise<Response> => {
    const step = steps[Math.min(calls, steps.length - 1)];
    calls += 1;
    return step instanceof Error ? Promise.reject(step) : Promise.resolve(reply(step ?? 200));
  };
  return { impl: impl as unknown as typeof fetch, calls: () => calls };
}

function policy(): RetryPolicy & { waited: number[] } {
  const waited: number[] = [];
  return {
    ...DEFAULT_RETRY,
    waited,
    sleep: (ms) => {
      waited.push(ms);
      return Promise.resolve();
    },
  };
}

describe('fetchWithRetry', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('a primeira resposta boa volta sem esperar', async () => {
    const { impl, calls } = scripted([200]);
    const p = policy();
    expect((await fetchWithRetry(impl, '/x', {}, p)).status).toBe(200);
    expect(calls()).toBe(1);
    expect(p.waited).toEqual([]);
  });

  it('503 repete com espera de 1s e depois 3s', async () => {
    const { impl, calls } = scripted([503, 503, 200]);
    const p = policy();
    expect((await fetchWithRetry(impl, '/x', {}, p)).status).toBe(200);
    expect(calls()).toBe(3);
    expect(p.waited).toEqual([1000, 3000]);
  });

  it('esgotadas as tentativas, devolve o último 5xx para quem chama decidir', async () => {
    const { impl, calls } = scripted([503]);
    expect((await fetchWithRetry(impl, '/x', {}, policy())).status).toBe(503);
    expect(calls()).toBe(3);
  });

  it('erro de rede repete, e na última tentativa é relançado', async () => {
    const { impl, calls } = scripted([new TypeError('Failed to fetch')]);
    await expect(fetchWithRetry(impl, '/x', {}, policy())).rejects.toThrow('Failed to fetch');
    expect(calls()).toBe(3);
  });

  it('4xx é resposta, não falha: volta na primeira', async () => {
    const { impl, calls } = scripted([404, 200]);
    expect((await fetchWithRetry(impl, '/x', {}, policy())).status).toBe(404);
    expect(calls()).toBe(1);
  });

  it('abandona a tentativa que passa de 8s e tenta de novo', async () => {
    vi.useFakeTimers();
    let calls = 0;
    const impl = ((_url: string, init: RequestInit) => {
      calls += 1;
      if (calls > 1) return Promise.resolve(reply(200));
      // A primeira nunca responde: só o prazo a encerra.
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          reject(new DOMException('aborted', 'AbortError'));
        });
      });
    }) as unknown as typeof fetch;

    const pending = fetchWithRetry(impl, '/x', {}, policy());
    await vi.advanceTimersByTimeAsync(7999);
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect((await pending).status).toBe(200);
    expect(calls).toBe(2);
  });

  it('repassa os cabeçalhos de quem chama', async () => {
    let seen: Headers | null = null;
    const impl = ((_url: string, init: RequestInit) => {
      seen = new Headers(init.headers);
      return Promise.resolve(reply(200));
    }) as unknown as typeof fetch;
    await fetchWithRetry(impl, '/x', { headers: { 'X-Internal-Token': 't' } }, policy());
    expect(seen).not.toBeNull();
    expect((seen as unknown as Headers).get('X-Internal-Token')).toBe('t');
  });
});

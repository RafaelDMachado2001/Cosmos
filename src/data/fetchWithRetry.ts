export interface RetryPolicy {
  readonly timeoutMs: number;
  readonly delaysMs: readonly number[];
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

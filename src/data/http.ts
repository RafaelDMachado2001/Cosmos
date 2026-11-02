type HeaderMap = Readonly<Record<string, string>>;

export type FieldErrors = Readonly<Record<string, readonly string[]>>;

export class ValidationError extends Error {
  constructor(readonly fields: FieldErrors) {
    super(Object.values(fields).flat()[0] ?? 'Dados inválidos.');
    this.name = 'ValidationError';
  }
}

export class PayloadTooLargeError extends Error {
  constructor(readonly url: string) {
    super(`${url} recusou o corpo: grande demais`);
    this.name = 'PayloadTooLargeError';
  }
}

export class RateLimitedError extends Error {
  constructor(readonly url: string) {
    super(`${url} recusou: pedidos demais`);
    this.name = 'RateLimitedError';
  }
}

export interface JsonClientOptions {
  readonly baseUrl: string;
  readonly credentials: RequestCredentials;
  readonly csrfHeaders: () => HeaderMap | Promise<HeaderMap>;
  readonly fetchImpl?: typeof fetch;
}

export interface JsonClient {
  get(path: string): Promise<Response>;
  send(method: string, path: string, body?: unknown): Promise<Response>;
}

const ACCEPT: HeaderMap = { Accept: 'application/json' };

async function checked(method: string, url: string, response: Response): Promise<Response> {
  if (response.status === 422) {
    const payload = (await response.json()) as { errors?: FieldErrors };
    throw new ValidationError(payload.errors ?? {});
  }
  if (response.status === 413) throw new PayloadTooLargeError(url);
  if (response.status === 429) throw new RateLimitedError(url);
  if (!response.ok) throw new Error(`${method} ${url} respondeu ${String(response.status)}`);
  return response;
}

export function createJsonClient(options: JsonClientOptions): JsonClient {
  const root = options.baseUrl.replace(/\/+$/, '');
  const fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));

  return {
    async get(path) {
      const url = `${root}${path}`;
      const response = await fetchImpl(url, { credentials: options.credentials, headers: ACCEPT });
      return checked('GET', url, response);
    },

    async send(method, path, body) {
      const url = `${root}${path}`;
      const isForm = body instanceof FormData;
      const response = await fetchImpl(url, {
        method,
        credentials: options.credentials,
        headers: {
          ...ACCEPT,
          ...(await options.csrfHeaders()),
          ...(body === undefined || isForm ? {} : { 'Content-Type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: isForm ? body : JSON.stringify(body) }),
      });
      return checked(method, url, response);
    },
  };
}

export async function dataOf<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const payload = (await response.json()) as { data: T };
  return payload.data;
}

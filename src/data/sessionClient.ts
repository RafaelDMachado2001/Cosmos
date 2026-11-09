import { xsrfToken } from '../core/session';
import { createJsonClient } from './http';
import type { JsonClient } from './http';

export function createSessionClient(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
  readCookie: () => string = () => document.cookie,
): JsonClient {
  const root = baseUrl.replace(/\/+$/, '');

  async function token(): Promise<string> {
    const existing = xsrfToken(readCookie());
    if (existing !== null) return existing;

    await fetchImpl(`${root}/api/sanctum/csrf-cookie`, { credentials: 'include' });
    const fresh = xsrfToken(readCookie());
    if (fresh === null) throw new Error('a API não entregou o XSRF-TOKEN');
    return fresh;
  }

  return createJsonClient({
    baseUrl: root,
    credentials: 'include',
    csrfHeaders: async () => ({ 'X-XSRF-TOKEN': await token() }),
    fetchImpl,
  });
}

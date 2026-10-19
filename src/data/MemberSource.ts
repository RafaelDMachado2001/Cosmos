/**
 * A conta do leitor na API (Sanctum no modo SPA).
 *
 * Toda chamada leva `credentials: 'include'`: o cookie de sessão é do host
 * da API, e o site é outra origem do mesmo domínio. As que escrevem devolvem
 * o cookie `XSRF-TOKEN` no cabeçalho `X-XSRF-TOKEN`, que é como o Laravel
 * confere CSRF sem formulário.
 */

import { parseMember, xsrfToken } from '../core/session';
import type { Member } from '../core/session';
import type { Locale } from '../core/types';

export interface MemberPatch {
  readonly name?: string;
  readonly handle?: string;
  readonly locale?: Locale;
}

/** Um 422 da API: os campos e as mensagens, para o formulário mostrar. */
export class MemberValidationError extends Error {
  constructor(readonly fields: Readonly<Record<string, readonly string[]>>) {
    super('dados recusados pela API');
  }
}

export interface MemberSource {
  /** O perfil, ou `null` sem sessão (a API responde 204). */
  me(): Promise<Member | null>;
  update(patch: MemberPatch): Promise<Member>;
  logout(): Promise<void>;
  /** Apaga a conta (anonimiza) e encerra a sessão. */
  remove(): Promise<void>;
  /** Para um `<a download>`: o navegador leva o cookie sozinho. */
  readonly exportUrl: string;
}

export function createMemberSource(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
  readCookie: () => string = () => document.cookie,
): MemberSource {
  const root = baseUrl.replace(/\/+$/, '');

  async function token(): Promise<string> {
    const existing = xsrfToken(readCookie());
    if (existing !== null) return existing;

    // Primeira escrita sem nenhum GET antes: o Sanctum entrega o cookie aqui.
    await fetchImpl(`${root}/api/sanctum/csrf-cookie`, { credentials: 'include' });
    const fresh = xsrfToken(readCookie());
    if (fresh === null) throw new Error('a API não entregou o XSRF-TOKEN');
    return fresh;
  }

  async function send(method: string, path: string, body?: unknown): Promise<Response> {
    const response = await fetchImpl(`${root}${path}`, {
      method,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'X-XSRF-TOKEN': await token(),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

    if (response.status === 422) {
      const payload = (await response.json()) as { errors?: Record<string, string[]> };
      throw new MemberValidationError(payload.errors ?? {});
    }
    if (!response.ok) throw new Error(`${method} ${path} respondeu ${String(response.status)}`);
    return response;
  }

  return {
    async me() {
      const response = await fetchImpl(`${root}/api/me`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (response.status === 204) return null;
      if (!response.ok) throw new Error(`/api/me respondeu ${String(response.status)}`);

      const member = parseMember(await response.json());
      if (member === null) throw new Error('/api/me devolveu um perfil fora do formato');
      return member;
    },

    async update(patch) {
      const member = parseMember(await (await send('PATCH', '/api/me', patch)).json());
      if (member === null) throw new Error('/api/me devolveu um perfil fora do formato');
      return member;
    },

    async logout() {
      await send('POST', '/auth/logout');
    },

    async remove() {
      await send('DELETE', '/api/me');
    },

    exportUrl: `${root}/api/me/export`,
  };
}

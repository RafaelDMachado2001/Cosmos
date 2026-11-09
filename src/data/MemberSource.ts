import { parseMember } from '../core/session';
import type { Member } from '../core/session';
import type { Locale } from '../core/types';
import { createSessionClient } from './sessionClient';

export interface MemberPatch {
  readonly name?: string;
  readonly handle?: string;
  readonly locale?: Locale;
}

export interface MemberSource {
  me(): Promise<Member | null>;
  update(patch: MemberPatch): Promise<Member>;
  logout(): Promise<void>;
  remove(): Promise<void>;
  readonly exportUrl: string;
}

async function memberFrom(response: Response): Promise<Member> {
  const member = parseMember(await response.json());
  if (member === null) throw new Error('/api/me devolveu um perfil fora do formato');
  return member;
}

export function createMemberSource(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
  readCookie: () => string = () => document.cookie,
): MemberSource {
  const root = baseUrl.replace(/\/+$/, '');
  const client = createSessionClient(root, fetchImpl, readCookie);

  return {
    async me() {
      const response = await client.get('/api/me');
      return response.status === 204 ? null : memberFrom(response);
    },

    async update(patch) {
      return memberFrom(await client.send('PATCH', '/api/me', patch));
    },

    async logout() {
      await client.send('POST', '/auth/logout');
    },

    async remove() {
      await client.send('DELETE', '/api/me');
    },

    exportUrl: `${root}/api/me/export`,
  };
}

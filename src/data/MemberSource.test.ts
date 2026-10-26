import { describe, expect, it, vi } from 'vitest';

import { MemberValidationError, createMemberSource } from './MemberSource';

const profile = {
  data: { id: 1, name: 'Ana', handle: 'ana', avatarUrl: null, email: 'a@x.com', locale: 'pt', providers: ['google'] },
};

function respond(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('createMemberSource', () => {
  it('sem sessão, me() é null (204)', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(respond(204)));
    const source = createMemberSource('https://api.example', fetchImpl, () => '');

    await expect(source.me()).resolves.toBeNull();
    expect(fetchImpl).toHaveBeenCalledWith('https://api.example/api/me', {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
  });

  it('com sessão, me() é o perfil', async () => {
    const source = createMemberSource('https://api.example', () => Promise.resolve(respond(200, profile)), () => '');

    await expect(source.me()).resolves.toMatchObject({ handle: 'ana', providers: ['google'] });
  });

  it('erro da API é erro, não anônimo', async () => {
    const source = createMemberSource('https://api.example', () => Promise.resolve(respond(500)), () => '');

    await expect(source.me()).rejects.toThrow('500');
  });

  it('escrever devolve o XSRF-TOKEN com credenciais', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() => Promise.resolve(respond(200, profile)));
    const source = createMemberSource('https://api.example/', fetchImpl, () => 'XSRF-TOKEN=abc%3D');

    await source.update({ name: 'Ana S.' });

    expect(fetchImpl).toHaveBeenCalledWith('https://api.example/api/me', {
      method: 'PATCH',
      credentials: 'include',
      headers: { Accept: 'application/json', 'X-XSRF-TOKEN': 'abc=', 'Content-Type': 'application/json' },
      body: '{"name":"Ana S."}',
    });
  });

  it('sem o cookie, pede um ao Sanctum antes de escrever', async () => {
    let cookie = '';
    const fetchImpl = vi.fn((url: string) => {
      if (url.endsWith('/api/sanctum/csrf-cookie')) cookie = 'XSRF-TOKEN=novo';
      return Promise.resolve(respond(204));
    });
    const source = createMemberSource('https://api.example', fetchImpl as unknown as typeof fetch, () => cookie);

    await source.logout();

    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      'https://api.example/api/sanctum/csrf-cookie',
      'https://api.example/auth/logout',
    ]);
  });

  it('422 vira erro com os campos', async () => {
    const source = createMemberSource(
      'https://api.example',
      () => Promise.resolve(respond(422, { errors: { handle: ['ocupado'] } })),
      () => 'XSRF-TOKEN=t',
    );

    const error = await source.update({ handle: 'bruno' }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(MemberValidationError);
    expect((error as MemberValidationError).fields).toEqual({ handle: ['ocupado'] });
  });

  it('remove apaga a conta com DELETE', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() => Promise.resolve(respond(204)));
    const source = createMemberSource('https://api.example', fetchImpl, () => 'XSRF-TOKEN=t');

    await source.remove();

    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({ method: 'DELETE', credentials: 'include' });
    expect(source.exportUrl).toBe('https://api.example/api/me/export');
  });
});

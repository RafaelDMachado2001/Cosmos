import { describe, expect, it, vi } from 'vitest';

import { createCommunitySource } from './CommunitySource';
import { RateLimitedError, UnauthorizedError, ValidationError } from './http';

function respond(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const NO_RETRY = { timeoutMs: 1000, delaysMs: [], sleep: () => Promise.resolve() };

function source(fetchImpl: typeof fetch) {
  return createCommunitySource('https://api.example/', fetchImpl, () => 'XSRF-TOKEN=t', NO_RETRY);
}

const COMMENT = {
  id: 9,
  body: 'Oi',
  createdAt: '2026-11-09T10:00:00Z',
  author: { name: 'Ana', handle: 'ana', avatarUrl: null },
};

describe('createCommunitySource', () => {
  it('lê os comentários sem credencial, com idioma e cursor', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(respond(200, { data: [COMMENT], meta: { next: null, total: 1 } })),
    );
    const page = await source(fetchImpl).comments('café', 'en', 40);

    expect(page.total).toBe(1);
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe('https://api.example/api/publications/caf%C3%A9/comments?locale=en&after=40');
    expect(init?.credentials).toBeUndefined();
  });

  it('publica com sessão e CSRF, e devolve o comentário', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() => Promise.resolve(respond(201, { data: COMMENT })));
    await expect(source(fetchImpl).post('cafe', 'pt', 'Oi')).resolves.toEqual(COMMENT);

    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe('https://api.example/api/me/comments');
    expect(init?.method).toBe('POST');
    expect(init?.credentials).toBe('include');
    expect(init?.headers).toMatchObject({ 'X-XSRF-TOKEN': 't' });
    expect(JSON.parse(init?.body as string)).toEqual({ publication: 'cafe', locale: 'pt', body: 'Oi' });
  });

  it('as recusas viram erros com tipo: 422, 429, 401', async () => {
    const fails = (status: number) =>
      source(() => Promise.resolve(respond(status, { errors: { body: ['x'] } }))).post('a', 'pt', 'b');
    await expect(fails(422)).rejects.toBeInstanceOf(ValidationError);
    await expect(fails(429)).rejects.toBeInstanceOf(RateLimitedError);
    await expect(fails(401)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('a reação de quem não entrou é a contagem pública', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() => Promise.resolve(respond(200, { data: { count: 3 } })));
    await expect(source(fetchImpl).reaction('cafe', 'pt', false)).resolves.toEqual({
      count: 3,
      reacted: false,
    });
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      'https://api.example/api/publications/cafe/reactions?locale=pt',
    );
  });

  it('marcar é PUT, desmarcar é DELETE, na rota do membro', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(respond(200, { data: { count: 4, reacted: true } })),
    );
    await source(fetchImpl).react('cafe', 'pt', true);
    await source(fetchImpl).react('cafe', 'pt', false);
    expect(fetchImpl.mock.calls.map(([url, init]) => `${init?.method ?? ''} ${url as string}`)).toEqual([
      'PUT https://api.example/api/me/reactions/cafe?locale=pt',
      'DELETE https://api.example/api/me/reactions/cafe?locale=pt',
    ]);
  });

  it('apagar usa o id', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() => Promise.resolve(respond(204)));
    await source(fetchImpl).remove(9);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('https://api.example/api/me/comments/9');
  });
});

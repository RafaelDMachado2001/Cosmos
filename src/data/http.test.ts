import { describe, expect, it, vi } from 'vitest';

import {
  PayloadTooLargeError,
  RateLimitedError,
  UnauthorizedError,
  ValidationError,
  createJsonClient,
  dataOf,
} from './http';

function respond(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function client(fetchImpl: typeof fetch) {
  return createJsonClient({
    baseUrl: 'https://api.example/',
    credentials: 'include',
    csrfHeaders: () => ({ 'X-XSRF-TOKEN': 't' }),
    fetchImpl,
  });
}

describe('createJsonClient', () => {
  it('lê sem CSRF e sem método explícito', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() => Promise.resolve(respond(200, { data: 1 })));

    await client(fetchImpl).get('/api/me');

    expect(fetchImpl).toHaveBeenCalledWith('https://api.example/api/me', {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
  });

  it('escreve JSON com o CSRF', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() => Promise.resolve(respond(200)));

    await client(fetchImpl).send('PATCH', '/api/me', { name: 'Ana' });

    expect(fetchImpl).toHaveBeenCalledWith('https://api.example/api/me', {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'X-XSRF-TOKEN': 't',
        'Content-Type': 'application/json',
      },
      body: '{"name":"Ana"}',
    });
  });

  it('manda FormData como está, sem Content-Type', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() => Promise.resolve(respond(201, { data: 1 })));
    const form = new FormData();

    await client(fetchImpl).send('POST', '/media', form);

    expect(fetchImpl.mock.calls[0]?.[1]).toEqual({
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json', 'X-XSRF-TOKEN': 't' },
      body: form,
    });
  });

  it('sem corpo, não manda body nem Content-Type', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() => Promise.resolve(respond(204)));

    await client(fetchImpl).send('DELETE', '/api/me');

    expect(fetchImpl.mock.calls[0]?.[1]).toEqual({
      method: 'DELETE',
      credentials: 'include',
      headers: { Accept: 'application/json', 'X-XSRF-TOKEN': 't' },
    });
  });

  it('422 vira ValidationError com os campos', async () => {
    const fetchImpl = () => Promise.resolve(respond(422, { errors: { handle: ['ocupado'] } }));

    const error = await client(fetchImpl)
      .send('PATCH', '/api/me', {})
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).fields).toEqual({ handle: ['ocupado'] });
    expect((error as ValidationError).message).toBe('ocupado');
  });

  it('413 e 429 têm erros próprios', async () => {
    await expect(
      client(() => Promise.resolve(respond(413))).send('POST', '/media'),
    ).rejects.toBeInstanceOf(PayloadTooLargeError);
    await expect(
      client(() => Promise.resolve(respond(429))).send('POST', '/x'),
    ).rejects.toBeInstanceOf(RateLimitedError);
  });

  it('sessão ausente (401) ou CSRF vencido (419) é UnauthorizedError', async () => {
    for (const status of [401, 419]) {
      await expect(
        client(() => Promise.resolve(respond(status))).send('POST', '/x'),
      ).rejects.toBeInstanceOf(UnauthorizedError);
    }
  });

  it('outro status de erro diz o método, o endereço e o status', async () => {
    await expect(client(() => Promise.resolve(respond(500))).get('/api/me')).rejects.toThrow(
      'GET https://api.example/api/me respondeu 500',
    );
  });
});

describe('dataOf', () => {
  it('desembrulha `data`, e 204 é vazio', async () => {
    await expect(dataOf<number>(respond(200, { data: 7 }))).resolves.toBe(7);
    await expect(dataOf(respond(204))).resolves.toBeUndefined();
  });
});

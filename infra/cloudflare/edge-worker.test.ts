import { describe, expect, it } from 'vitest';

import { CACHE_TTL, forward, handle, routed } from './edge-worker.js';

const ENV = { ORIGIN: 'https://cosmos-api-abc-rj.a.run.app', EDGE_SECRET: 's3gredo' };

describe('borda: o Worker que repassa ao Cloud Run', () => {
  it('troca o host pelo do run.app e leva o original em X-Forwarded-Host', () => {
    const out = forward(new Request('https://admin.rdmlabs.com.br/admin/login?next=%2Fadmin'), ENV);

    expect(out.url).toBe('https://cosmos-api-abc-rj.a.run.app/admin/login?next=%2Fadmin');
    expect(out.headers.get('X-Forwarded-Host')).toBe('admin.rdmlabs.com.br');
    expect(out.headers.get('X-Forwarded-Proto')).toBe('https');
    expect(out.headers.get('X-Edge-Secret')).toBe('s3gredo');
    expect(out.redirect).toBe('manual');
  });

  it('o X-Forwarded-For do cliente não sobrevive: vale o IP que a Cloudflare viu', () => {
    const spoofed = new Request('https://api.rdmlabs.com.br/api/publications', {
      headers: { 'X-Forwarded-For': '1.2.3.4', 'CF-Connecting-IP': '203.0.113.9' },
    });
    expect(forward(spoofed, ENV).headers.get('X-Forwarded-For')).toBe('203.0.113.9');

    const anonymous = new Request('https://api.rdmlabs.com.br/x', { headers: { 'X-Forwarded-For': '1.2.3.4' } });
    expect(forward(anonymous, ENV).headers.get('X-Forwarded-For')).toBeNull();
  });

  it('mantém método, corpo e cookies', async () => {
    const out = forward(
      new Request('https://admin.rdmlabs.com.br/admin/api/publications', {
        method: 'POST',
        body: '{"slug":"x"}',
        headers: { Cookie: 'rdm_admin=abc', 'Content-Type': 'application/json' },
      }),
      ENV,
    );

    expect(out.method).toBe('POST');
    expect(out.headers.get('Cookie')).toBe('rdm_admin=abc');
    expect(await out.text()).toBe('{"slug":"x"}');
  });
});

describe('borda: o que não chega ao Cloud Run', () => {
  function deps(origin: (request: Request) => Response = () => new Response('{"data":[]}')) {
    const store = new Map<string, Response>();
    const calls: Request[] = [];
    const pending: Promise<unknown>[] = [];
    return {
      calls,
      store,
      ctx: { waitUntil: (promise: Promise<unknown>) => void pending.push(promise) },
      settle: () => Promise.all(pending),
      deps: {
        cache: {
          match: (key: Request) => Promise.resolve(store.get(key.url)?.clone()),
          put: (key: Request, response: Response) => {
            store.set(key.url, response);
            return Promise.resolve();
          },
        },
        fetch: ((request: Request) => {
          calls.push(request);
          return Promise.resolve(origin(request));
        }) as unknown as typeof fetch,
      },
    };
  }

  it('cada host só repassa o que atende', () => {
    for (const path of ['/api/publications', '/auth/google/redirect', '/up']) {
      expect(routed(new URL(`https://api.rdmlabs.com.br${path}`))).toBe(true);
    }
    for (const path of ['/admin', '/admin/login', '/livewire-5677c115/update', '/css/filament/app.css', '/up']) {
      expect(routed(new URL(`https://admin.rdmlabs.com.br${path}`))).toBe(true);
    }
    for (const url of [
      'https://api.rdmlabs.com.br/wp-login.php',
      'https://api.rdmlabs.com.br/.env',
      'https://api.rdmlabs.com.br/admin',
      'https://admin.rdmlabs.com.br/api/publications',
      'https://admin.rdmlabs.com.br/phpmyadmin/',
      'https://admin.rdmlabs.com.br/administrator',
      'https://outro.rdmlabs.com.br/api/publications',
    ]) {
      expect(routed(new URL(url))).toBe(false);
    }
  });

  it('varredura de bot morre em 404 na borda', async () => {
    const t = deps();

    const response = await handle(new Request('https://api.rdmlabs.com.br/wp-admin/'), ENV, t.ctx, t.deps);

    expect(response.status).toBe(404);
    expect(t.calls).toHaveLength(0);
  });

  it('o robots.txt sai da borda e fecha os dois hosts', async () => {
    const t = deps();

    const response = await handle(new Request('https://admin.rdmlabs.com.br/robots.txt'), ENV, t.ctx, t.deps);

    expect(await response.text()).toBe('User-agent: *\nDisallow: /\n');
    expect(t.calls).toHaveLength(0);
  });

  it('a leitura pública vai para o cache sem cookie e a segunda vem dele', async () => {
    const t = deps();
    const url = 'https://api.rdmlabs.com.br/api/publications?locale=pt';

    const first = await handle(
      new Request(url, { headers: { Cookie: 'rdm_session=x', Origin: 'https://cosmos.rdmlabs.com.br' } }),
      ENV,
      t.ctx,
      t.deps,
    );
    await t.settle();
    const second = await handle(new Request(url), ENV, t.ctx, t.deps);

    expect(first.headers.get('X-Edge-Cache')).toBe('MISS');
    expect(first.headers.get('Cache-Control')).toBe(`public, max-age=${String(CACHE_TTL)}`);
    expect(t.calls[0]?.headers.get('Cookie')).toBeNull();
    expect(t.calls[0]?.headers.get('Origin')).toBeNull();
    expect(second.headers.get('X-Edge-Cache')).toBe('HIT');
    expect(await second.text()).toBe('{"data":[]}');
    expect(t.calls).toHaveLength(1);
  });

  it('o build com o token interno sempre lê da origem', async () => {
    const t = deps();
    const url = 'https://api.rdmlabs.com.br/api/publications/x?locale=pt';
    await handle(new Request(url), ENV, t.ctx, t.deps);
    await t.settle();

    await handle(new Request(url, { headers: { 'X-Internal-Token': 't' } }), ENV, t.ctx, t.deps);

    expect(t.calls).toHaveLength(2);
    expect(t.calls[1]?.headers.get('X-Internal-Token')).toBe('t');
  });

  it('resposta com Set-Cookie ou erro nunca vai para o cache', async () => {
    for (const origin of [
      () => new Response('{}', { headers: { 'Set-Cookie': 'rdm_session=y' } }),
      () => new Response('erro', { status: 500 }),
    ]) {
      const t = deps(origin);
      await handle(new Request('https://api.rdmlabs.com.br/api/publications'), ENV, t.ctx, t.deps);
      await t.settle();
      expect(t.store.size).toBe(0);
    }
  });

  it('a conta do leitor e as escritas passam direto, com cookie', async () => {
    const t = deps();

    await handle(new Request('https://api.rdmlabs.com.br/api/me', { headers: { Cookie: 'rdm_session=x' } }), ENV, t.ctx, t.deps);
    await handle(
      new Request('https://admin.rdmlabs.com.br/admin/api/publications', { method: 'POST', body: '{}' }),
      ENV,
      t.ctx,
      t.deps,
    );

    expect(t.calls.map((request) => request.method)).toEqual(['GET', 'POST']);
    expect(t.calls[0]?.headers.get('Cookie')).toBe('rdm_session=x');
    expect(t.store.size).toBe(0);
  });
});

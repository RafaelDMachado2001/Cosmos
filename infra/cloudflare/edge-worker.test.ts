import { describe, expect, it } from 'vitest';

import { forward } from './edge-worker.js';

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

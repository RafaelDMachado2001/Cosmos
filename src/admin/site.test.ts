import { describe, expect, it } from 'vitest';

import { siteHost } from './site';

describe('siteHost', () => {
  it('le o host da origem que o servidor declara', () => {
    expect(siteHost('https://cosmos.rdmlabs.com.br', 'admin.rdmlabs.com.br')).toBe('cosmos.rdmlabs.com.br');
    expect(siteHost('http://localhost:8080/', 'x')).toBe('localhost:8080');
  });

  it('cai no host da pagina sem origem valida', () => {
    expect(siteHost(null, 'localhost:8080')).toBe('localhost:8080');
    expect(siteHost('', 'localhost:8080')).toBe('localhost:8080');
    expect(siteHost('cosmos.rdmlabs.com.br', 'localhost:8080')).toBe('localhost:8080');
  });
});

import { describe, expect, it } from 'vitest';

import { siteHost, siteOrigin } from './site';

describe('siteHost', () => {
  it('lê o host da origem que o servidor declara', () => {
    expect(siteHost('https://cosmos.rdmlabs.com.br', 'admin.rdmlabs.com.br')).toBe('cosmos.rdmlabs.com.br');
    expect(siteHost('http://localhost:8080/', 'x')).toBe('localhost:8080');
  });

  it('cai no host da página sem origem valida', () => {
    expect(siteHost(null, 'localhost:8080')).toBe('localhost:8080');
    expect(siteHost('', 'localhost:8080')).toBe('localhost:8080');
    expect(siteHost('cosmos.rdmlabs.com.br', 'localhost:8080')).toBe('localhost:8080');
  });
});

describe('siteOrigin', () => {
  it('lê a origem que o servidor declara, sem caminho', () => {
    expect(siteOrigin('https://cosmos.rdmlabs.com.br/', 'https://admin.rdmlabs.com.br')).toBe(
      'https://cosmos.rdmlabs.com.br',
    );
  });

  it('cai na origem da página sem origem valida', () => {
    expect(siteOrigin(null, 'http://localhost:8080')).toBe('http://localhost:8080');
    expect(siteOrigin('cosmos.rdmlabs.com.br', 'http://localhost:8080')).toBe('http://localhost:8080');
  });
});

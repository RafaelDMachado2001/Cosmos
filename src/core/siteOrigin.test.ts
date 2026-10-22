import { describe, expect, it } from 'vitest';

import { LOCAL_ORIGIN, resolveSiteOrigin } from './siteOrigin';

describe('resolveSiteOrigin', () => {
  it('VITE_SITE_URL vence, sem barra final', () => {
    expect(
      resolveSiteOrigin({
        VITE_SITE_URL: 'https://cosmos.rdmlabs.com.br/',
        VITE_VERCEL_ENV: 'production',
        VITE_VERCEL_PROJECT_PRODUCTION_URL: 'outro.vercel.app',
      }),
    ).toBe('https://cosmos.rdmlabs.com.br');
  });

  it('produção na Vercel sem VITE_SITE_URL usa o domínio de produção do projeto', () => {
    expect(
      resolveSiteOrigin({ VITE_VERCEL_ENV: 'production', VITE_VERCEL_PROJECT_PRODUCTION_URL: 'cosmos.rdmlabs.com.br' }),
    ).toBe('https://cosmos.rdmlabs.com.br');
  });

  it('produção sem origem nenhuma derruba o build em vez de publicar localhost', () => {
    expect(() => resolveSiteOrigin({ VITE_VERCEL_ENV: 'production' })).toThrow(/VITE_SITE_URL/);
    expect(() => resolveSiteOrigin({ VITE_VERCEL_ENV: 'production', VITE_SITE_URL: '' })).toThrow();
  });

  it('aceita as variáveis de sistema sem o prefixo do Vite', () => {
    expect(resolveSiteOrigin({ VERCEL_ENV: 'production', VERCEL_PROJECT_PRODUCTION_URL: 'cosmos.rdmlabs.com.br' })).toBe(
      'https://cosmos.rdmlabs.com.br',
    );
  });

  it('o preview aponta para o próprio endereço', () => {
    expect(resolveSiteOrigin({ VITE_VERCEL_ENV: 'preview', VITE_VERCEL_URL: 'cosmos-abc.vercel.app' })).toBe(
      'https://cosmos-abc.vercel.app',
    );
  });

  it('fora da Vercel, o desenvolvimento local', () => {
    expect(resolveSiteOrigin({})).toBe(LOCAL_ORIGIN);
    expect(resolveSiteOrigin({ VITE_VERCEL_ENV: 'preview' })).toBe(LOCAL_ORIGIN);
  });
});

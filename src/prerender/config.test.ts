import { describe, expect, it } from 'vitest';

import { apiUrlFrom, distDir, templateDir } from './config';

describe('configuração do prerender', () => {
  it('usa dist quando DIST não vem do ambiente', () => {
    expect(distDir({})).toBe('dist');
  });

  it('respeita o DIST do ambiente, que é como o job grava no volume', () => {
    expect(distDir({ DIST: '/srv/site' })).toBe('/srv/site');
  });

  it('ignora DIST vazio em vez de gravar na raiz', () => {
    expect(distDir({ DIST: '' })).toBe('dist');
  });

  it('lê o template do próprio DIST quando TEMPLATE_DIR não vem: e o caso do build', () => {
    expect(templateDir({ DIST: '/srv/site' })).toBe('/srv/site');
  });

  it('separa template de destino, que é o que impede o job de se envenenar', () => {
    // O prerender grava a home composta por cima de <DIST>/index.html. Se o
    // template viesse de lá, a segunda publicação leria um arquivo cujo SLOT já
    // foi preenchido e morreria.
    expect(templateDir({ DIST: '/srv/site', TEMPLATE_DIR: '/srv/render/dist-ssr' })).toBe(
      '/srv/render/dist-ssr',
    );
  });

  it('prefere PRERENDER_API_URL a VITE_API_URL', () => {
    expect(apiUrlFrom({ PRERENDER_API_URL: 'http://web', VITE_API_URL: '/' })).toBe('http://web');
  });

  it('trata / como ausência: em Node não há mesma origem', () => {
    expect(apiUrlFrom({ VITE_API_URL: '/' })).toBeNull();
  });

  it('remove a barra final para não gerar // na URL montada', () => {
    expect(apiUrlFrom({ PRERENDER_API_URL: 'http://web/' })).toBe('http://web');
  });
});

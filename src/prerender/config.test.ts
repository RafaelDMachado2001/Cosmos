import { describe, expect, it } from 'vitest';

import { apiUrlFrom, distDir, templateDir } from './config';

describe('configuracao do prerender', () => {
  it('usa dist quando DIST nao vem do ambiente', () => {
    expect(distDir({})).toBe('dist');
  });

  it('respeita o DIST do ambiente, que e como o job grava no volume', () => {
    expect(distDir({ DIST: '/srv/site' })).toBe('/srv/site');
  });

  it('ignora DIST vazio em vez de gravar na raiz', () => {
    expect(distDir({ DIST: '' })).toBe('dist');
  });

  it('le o template do proprio DIST quando TEMPLATE_DIR nao vem: e o caso do build', () => {
    expect(templateDir({ DIST: '/srv/site' })).toBe('/srv/site');
  });

  it('separa template de destino, que e o que impede o job de se envenenar', () => {
    // O prerender grava a home composta por cima de <DIST>/index.html. Se o
    // template viesse de la, a segunda publicacao leria um arquivo cujo SLOT ja
    // foi preenchido e morreria.
    expect(templateDir({ DIST: '/srv/site', TEMPLATE_DIR: '/srv/render/dist' })).toBe(
      '/srv/render/dist',
    );
  });

  it('prefere PRERENDER_API_URL a VITE_API_URL', () => {
    expect(apiUrlFrom({ PRERENDER_API_URL: 'http://web', VITE_API_URL: '/' })).toBe('http://web');
  });

  it('trata / como ausencia: em Node nao ha mesma origem', () => {
    expect(apiUrlFrom({ VITE_API_URL: '/' })).toBeNull();
  });

  it('remove a barra final para nao gerar // na URL montada', () => {
    expect(apiUrlFrom({ PRERENDER_API_URL: 'http://web/' })).toBe('http://web');
  });
});

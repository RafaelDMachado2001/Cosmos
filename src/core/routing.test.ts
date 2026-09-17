import { describe, expect, it } from 'vitest';

import { articlePath, closeTarget, homePath, parseRoute } from './routing';
import { LOCALES } from './types';

describe('parseRoute', () => {
  it('trata a raiz como início sem idioma decidido', () => {
    expect(parseRoute('/')).toEqual({ kind: 'home', locale: null });
  });

  it('lê o idioma do primeiro segmento', () => {
    expect(parseRoute('/pt')).toEqual({ kind: 'home', locale: 'pt' });
    expect(parseRoute('/en')).toEqual({ kind: 'home', locale: 'en' });
  });

  it('tolera a barra final', () => {
    expect(parseRoute('/en/')).toEqual({ kind: 'home', locale: 'en' });
    expect(parseRoute('/pt/publicacoes/n-mais-1/')).toEqual({
      kind: 'article',
      locale: 'pt',
      slug: 'n-mais-1',
    });
  });

  it('reconhece a rota de artigo em cada idioma', () => {
    expect(parseRoute('/pt/publicacoes/code-review-sem-atrito')).toEqual({
      kind: 'article',
      locale: 'pt',
      slug: 'code-review-sem-atrito',
    });
    expect(parseRoute('/en/publications/code-review-sem-atrito')).toEqual({
      kind: 'article',
      locale: 'en',
      slug: 'code-review-sem-atrito',
    });
  });

  it('recusa o segmento do outro idioma', () => {
    expect(parseRoute('/pt/publications/x').kind).toBe('notfound');
    expect(parseRoute('/en/publicacoes/x').kind).toBe('notfound');
  });

  it('recusa idioma desconhecido', () => {
    expect(parseRoute('/fr/publications/x').kind).toBe('notfound');
    expect(parseRoute('/publicacoes/x').kind).toBe('notfound');
  });

  it('recusa a rota de artigo sem slug', () => {
    expect(parseRoute('/pt/publicacoes').kind).toBe('notfound');
    expect(parseRoute('/pt/publicacoes/').kind).toBe('notfound');
  });

  it('recusa segmentos a mais', () => {
    expect(parseRoute('/pt/publicacoes/slug/extra').kind).toBe('notfound');
    expect(parseRoute('/pt/extra').kind).toBe('notfound');
  });

  it('decodifica o slug percent-encoded', () => {
    expect(parseRoute('/pt/publicacoes/no%C3%A7%C3%B5es')).toEqual({
      kind: 'article',
      locale: 'pt',
      slug: 'noções',
    });
  });

  it('não quebra com percent-encoding inválido', () => {
    expect(parseRoute('/pt/publicacoes/%E0%A4%A').kind).toBe('notfound');
  });
});

describe('articlePath', () => {
  it('usa o segmento do idioma', () => {
    expect(articlePath('pt', 'shaders-glsl-para-interfaces')).toBe(
      '/pt/publicacoes/shaders-glsl-para-interfaces',
    );
    expect(articlePath('en', 'shaders-glsl-para-interfaces')).toBe(
      '/en/publications/shaders-glsl-para-interfaces',
    );
  });

  it('é o inverso de parseRoute', () => {
    for (const locale of LOCALES) {
      const route = parseRoute(articlePath(locale, 'noções-de-índice'));
      expect(route).toEqual({ kind: 'article', locale, slug: 'noções-de-índice' });
    }
  });
});

describe('homePath', () => {
  it('é o idioma sozinho', () => {
    expect(homePath('pt')).toBe('/pt');
    expect(homePath('en')).toBe('/en');
  });

  it('é o inverso de parseRoute', () => {
    for (const locale of LOCALES) {
      expect(parseRoute(homePath(locale))).toEqual({ kind: 'home', locale });
    }
  });
});

describe('closeTarget', () => {
  it('volta no histórico quando foi a abertura que empilhou a entrada', () => {
    expect(closeTarget(true, 'pt')).toEqual({ kind: 'back' });
  });

  it('substitui pela raiz do idioma quando a chegada foi direta', () => {
    expect(closeTarget(false, 'pt')).toEqual({ kind: 'replace', path: '/pt' });
    expect(closeTarget(false, 'en')).toEqual({ kind: 'replace', path: '/en' });
  });
});

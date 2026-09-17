import { describe, expect, it } from 'vitest';

import { prerenderPages } from './pages';
import { PUBLICATIONS } from '../data/publications';
import { LOCALES } from '../core/types';
import { SITE } from '../site';

const output = await prerenderPages();
const at = (path: string) => output.pages.find((page) => page.path === path);

describe('prerenderPages', () => {
  it('grava a raiz de cada idioma e cada publicação em cada idioma', () => {
    expect(output.pages).toHaveLength(LOCALES.length * (PUBLICATIONS.length + 1));
    expect(at('/pt')).toBeDefined();
    expect(at('/en')).toBeDefined();
  });

  it('usa o caminho traduzido de cada idioma', () => {
    expect(at('/pt/publicacoes/code-review-sem-atrito')).toBeDefined();
    expect(at('/en/publications/code-review-sem-atrito')).toBeDefined();
    expect(at('/en/publicacoes/code-review-sem-atrito')).toBeUndefined();
  });

  it('leva o texto do artigo no corpo, não só o título', () => {
    const page = at('/pt/publicacoes/code-review-sem-atrito');
    expect(page?.body).toContain('Code review sem atrito');
    expect(page?.body).toContain('<h1');
    expect(page?.body.length ?? 0).toBeGreaterThan(1000);
  });

  it('cada artigo alcança o outro idioma e a constelação', () => {
    const page = at('/pt/publicacoes/code-review-sem-atrito');
    expect(page?.body).toContain('href="/en/publications/code-review-sem-atrito"');
    expect(page?.body).toContain('href="/pt"');
  });

  it('cada artigo alcança o acervo inteiro', () => {
    const page = at('/pt/publicacoes/code-review-sem-atrito');
    for (const publication of PUBLICATIONS) {
      expect(page?.body).toContain(`href="/pt/publicacoes/${publication.slug}"`);
    }
  });

  it('a raiz sem JavaScript lista todas as publicações', () => {
    const home = at('/pt');
    for (const publication of PUBLICATIONS) {
      expect(home?.body).toContain(`href="/pt/publicacoes/${publication.slug}"`);
    }
  });

  it('o cabeçalho canoniza a própria rota', () => {
    expect(at('/en/publications/code-review-sem-atrito')?.head).toContain(
      `rel="canonical" data-head href="${SITE.origin}/en/publications/code-review-sem-atrito"`,
    );
  });

  it('só o artigo traz JSON-LD', () => {
    expect(at('/pt/publicacoes/code-review-sem-atrito')?.head).toContain('application/ld+json');
    expect(at('/pt')?.head).not.toContain('application/ld+json');
  });

  it('declara o idioma do documento', () => {
    expect(at('/pt')?.lang).toBe('pt-BR');
    expect(at('/en')?.lang).toBe('en');
  });

  it('escapa o que vai para o HTML', () => {
    for (const page of output.pages) {
      expect(page.body).not.toContain('<script');
    }
  });

  it('traz sitemap e robots prontos para gravar', () => {
    expect(output.sitemap).toContain('<urlset');
    expect(output.robots).toContain('Sitemap: ');
    for (const publication of PUBLICATIONS) {
      expect(output.sitemap).toContain(`/pt/publicacoes/${publication.slug}</loc>`);
    }
  });
});

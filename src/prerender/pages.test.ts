import { describe, expect, it } from 'vitest';

import { ARCHIVE_LIMIT, prerenderPages } from './pages';
import { PUBLICATIONS } from '../data/publications';
import { LOCALES } from '../core/types';
import type { PublicationsSource } from '../data/PublicationsSource';
import { SITE } from '../site';
import { createStaticSource } from '../data/PublicationsSource';

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

  it('o artigo traz o Article em JSON-LD, a home o WebSite', () => {
    expect(at('/pt/publicacoes/code-review-sem-atrito')?.head).toContain('"@type":"Article"');
    expect(at('/pt')?.head).toContain('"@type":"WebSite"');
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

  it('traz um feed RSS por idioma, com o acervo daquele idioma', () => {
    expect(output.rss.pt).toContain('<rss version="2.0">');
    expect(output.rss.en).toContain('<rss version="2.0">');
    for (const publication of PUBLICATIONS) {
      expect(output.rss.pt).toContain(`/pt/publicacoes/${publication.slug}</link>`);
      expect(output.rss.en).toContain(`/en/publications/${publication.slug}</link>`);
    }
  });

  it('prerenderiza a partir da fonte injetada, nao do acervo semente', async () => {
    const fixture = createStaticSource([
      {
        slug: 'so-esta-publicacao',
        category: 'artigo',
        publishedAt: '2026-01-15T12:00:00.000Z',
        content: {
          pt: { title: 'So esta', summary: 'Resumo.', body: 'Paragrafo.' },
          en: { title: 'Only this', summary: 'Summary.', body: 'Paragraph.' },
        },
      },
    ]);

    const { pages } = await prerenderPages(fixture);

    const articles = pages.filter((page) => page.path.includes('/publicacoes/'));
    expect(articles).toHaveLength(1);
    expect(articles[0]?.path).toContain('so-esta-publicacao');
  });

  it('publicação só num idioma não expõe link morto para o outro, nem entra no sitemap do outro', async () => {
    // O painel permite publicar só numa tradução — é o que o adapter HTTP
    // real devolve (o join por locale simplesmente omite o slug do idioma
    // sem tradução). `createStaticSource` não modela isso: todo item seu tem
    // as duas, daí a fonte feita à mão aqui.
    const soEmPortugues = {
      slug: 'so-em-portugues',
      publishedAt: '2026-01-15T12:00:00.000Z',
      category: 'artigo' as const,
      title: 'Só em português',
      summary: 'Resumo.',
    };
    const fixture: PublicationsSource = {
      list: (query) => Promise.resolve(query.locale === 'pt' ? [soEmPortugues] : []),
      get: (slug, locale) =>
        Promise.resolve(
          locale === 'pt' && slug === soEmPortugues.slug
            ? { ...soEmPortugues, body: 'Paragrafo.', locales: ['pt'] as const, tags: [] }
            : null,
        ),
    };

    const { pages, sitemap } = await prerenderPages(fixture);

    const ptPage = pages.find((page) => page.path === '/pt/publicacoes/so-em-portugues');
    expect(ptPage).toBeDefined();
    expect(ptPage?.body).not.toContain('href="/en/publications/so-em-portugues"');
    expect(pages.find((page) => page.path === '/en/publications/so-em-portugues')).toBeUndefined();
    expect(sitemap).toContain('/pt/publicacoes/so-em-portugues');
    expect(sitemap).not.toContain('/en/publications/so-em-portugues');
  });

  it('pede o acervo inteiro: o limite padrao da API derrubaria o build na 101a publicacao', async () => {
    const asked: (number | undefined)[] = [];
    const inner = createStaticSource(PUBLICATIONS);
    const spy = {
      list: (query: Parameters<typeof inner.list>[0]) => {
        asked.push(query.limit);
        return inner.list(query);
      },
      get: (...args: Parameters<typeof inner.get>) => inner.get(...args),
    };

    await prerenderPages(spy);

    expect(asked.length).toBeGreaterThan(0);
    // 1000 e o teto que a API aceita (PublicationController, regra de `limit`).
    expect(ARCHIVE_LIMIT).toBe(1000);
    expect(asked).toEqual(asked.map(() => 1000));
  });
});

import { describe, expect, it } from 'vitest';

import { robotsTxt, sitemapXml } from './sitemap';
import type { MetaSite } from './seo';
import { LOCALES } from './types';

const SITE: MetaSite = {
  origin: 'https://rdmlabs.dev',
  siteName: 'RDM Labs',
  authorName: 'Rafael Dorneles Machado',
};

const PUBLICATIONS = [
  { slug: 'code-review-sem-atrito', publishedAt: '2025-09-12T12:00:00.000Z', locales: LOCALES },
  {
    slug: 'shaders-glsl-para-interfaces',
    publishedAt: '2026-01-20T12:00:00.000Z',
    locales: LOCALES,
  },
];

describe('sitemapXml', () => {
  const xml = sitemapXml(SITE, PUBLICATIONS);

  it('é um urlset declarado', () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
  });

  it('lista a raiz dos dois idiomas', () => {
    expect(xml).toContain('<loc>https://rdmlabs.dev/pt</loc>');
    expect(xml).toContain('<loc>https://rdmlabs.dev/en</loc>');
  });

  it('lista cada publicação nos dois idiomas', () => {
    expect(xml).toContain('<loc>https://rdmlabs.dev/pt/publicacoes/code-review-sem-atrito</loc>');
    expect(xml).toContain('<loc>https://rdmlabs.dev/en/publications/code-review-sem-atrito</loc>');
  });

  it('data de publicação como lastmod, só o dia', () => {
    expect(xml).toContain('<lastmod>2025-09-12</lastmod>');
  });

  it('usa updatedAt como lastmod quando é mais recente que a publicação', () => {
    const editada = sitemapXml(SITE, [
      {
        slug: 'editado-depois',
        publishedAt: '2025-09-12T12:00:00.000Z',
        updatedAt: '2026-02-01T08:00:00.000Z',
        locales: LOCALES,
      },
    ]);
    expect(editada).toContain('<lastmod>2026-02-01</lastmod>');
    expect(editada).not.toContain('<lastmod>2025-09-12</lastmod>');
  });

  it('ignora updatedAt mais antigo que a publicação', () => {
    const semEdicao = sitemapXml(SITE, [
      {
        slug: 'sem-edicao',
        publishedAt: '2025-09-12T12:00:00.000Z',
        updatedAt: '2025-09-12T12:00:00.000Z',
        locales: LOCALES,
      },
    ]);
    expect(semEdicao).toContain('<lastmod>2025-09-12</lastmod>');
  });

  it('publicação num só idioma não gera url nem alternate para o outro', () => {
    const soPt = sitemapXml(SITE, [
      { slug: 'so-em-portugues', publishedAt: '2025-09-12T12:00:00.000Z', locales: ['pt'] },
    ]);
    expect(soPt).toContain('<loc>https://rdmlabs.dev/pt/publicacoes/so-em-portugues</loc>');
    expect(soPt).not.toContain('publications/so-em-portugues');
    expect(soPt).not.toContain('hreflang="en" href="https://rdmlabs.dev/en/publications/so-em-portugues"');
    // x-default cai no único idioma que existe, não no padrão ausente.
    expect(soPt).toContain(
      '<xhtml:link rel="alternate" hreflang="x-default" href="https://rdmlabs.dev/pt/publicacoes/so-em-portugues"/>',
    );
    // As duas raízes (pt/en) mais a única url do artigo — não duas.
    expect(soPt.match(/<url>/g)?.length).toBe(3);
  });

  it('publicação só em inglês usa inglês como x-default', () => {
    const soEn = sitemapXml(SITE, [
      { slug: 'english-only', publishedAt: '2025-09-12T12:00:00.000Z', locales: ['en'] },
    ]);
    expect(soEn).toContain(
      '<xhtml:link rel="alternate" hreflang="x-default" href="https://rdmlabs.dev/en/publications/english-only"/>',
    );
    expect(soEn).not.toContain('/pt/publicacoes/english-only');
  });

  it('cada url aponta para as versões no outro idioma', () => {
    expect(xml).toContain(
      '<xhtml:link rel="alternate" hreflang="en" href="https://rdmlabs.dev/en/publications/code-review-sem-atrito"/>',
    );
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
  });

  it('uma url por idioma por publicação, mais as duas raízes', () => {
    expect(xml.match(/<url>/g)?.length).toBe(PUBLICATIONS.length * 2 + 2);
  });

  it('não duplica a barra quando a origem traz uma', () => {
    expect(sitemapXml({ ...SITE, origin: 'https://rdmlabs.dev/' }, PUBLICATIONS)).not.toContain(
      'rdmlabs.dev//',
    );
  });
});

describe('robotsTxt', () => {
  it('libera tudo e aponta o sitemap absoluto', () => {
    expect(robotsTxt(SITE)).toBe(
      'User-agent: *\nAllow: /\n\nSitemap: https://rdmlabs.dev/sitemap.xml\n',
    );
  });
});

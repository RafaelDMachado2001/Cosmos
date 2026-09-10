import { describe, expect, it } from 'vitest';

import { PUBLICATIONS, REAL_PUBLICATION_SLUG } from './publications';
import { layoutHealth, placeStars } from '../core/timeline';
import { CATEGORIES, LOCALES } from '../core/types';

describe('PUBLICATIONS', () => {
  it('traz as 14 publicações do protótipo', () => {
    expect(PUBLICATIONS).toHaveLength(14);
  });

  it('não repete slug', () => {
    expect(new Set(PUBLICATIONS.map((p) => p.slug)).size).toBe(PUBLICATIONS.length);
  });

  it('usa apenas slugs ASCII', () => {
    // Garante que o FNV-1a sobre bytes UTF-8 e sobre code units UTF-16 dão o
    // mesmo resultado nos dados reais — é o que protege a paridade com o PHP
    // mesmo se alguém portar o algoritmo pela forma errada.
    for (const publication of PUBLICATIONS) {
      // eslint-disable-next-line no-control-regex
      expect(publication.slug).toMatch(/^[\x00-\x7F]+$/);
    }
  });

  it('usa slugs em formato de URL', () => {
    for (const publication of PUBLICATIONS) {
      expect(publication.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });

  it('exercita as quatro categorias', () => {
    const used = new Set(PUBLICATIONS.map((p) => p.category));
    for (const category of CATEGORIES) expect(used.has(category)).toBe(true);
  });

  it('tem data válida e ordenável', () => {
    for (const publication of PUBLICATIONS) {
      expect(Number.isNaN(Date.parse(publication.publishedAt))).toBe(false);
    }
  });

  it('distribui as publicações de 2024 a 2026', () => {
    const years = PUBLICATIONS.map((p) => new Date(p.publishedAt).getUTCFullYear());
    expect(Math.min(...years)).toBe(2024);
    expect(Math.max(...years)).toBe(2026);
  });

  it('traz título, resumo e corpo nos dois idiomas', () => {
    for (const publication of PUBLICATIONS) {
      for (const locale of LOCALES) {
        const content = publication.content[locale];
        expect(content.title.trim()).not.toBe('');
        expect(content.summary.trim()).not.toBe('');
        expect(content.body.length).toBeGreaterThan(0);
        for (const paragraph of content.body) expect(paragraph.trim()).not.toBe('');
      }
    }
  });

  it('destaca exatamente uma publicação', () => {
    expect(PUBLICATIONS.filter((p) => p.featured)).toHaveLength(1);
  });

  it('preserva a única publicação real, com o título corrigido', () => {
    const real = PUBLICATIONS.find((p) => p.slug === REAL_PUBLICATION_SLUG);
    expect(real).toBeDefined();
    expect(real?.publishedAt.slice(0, 10)).toBe('2026-09-09');
    expect(real?.category).toBe('artigo');
    expect(real?.featured).toBe(true);
    expect(real?.content.pt.title).toBe('Arquitetura e Orquestração de LLMs');
  });
});

describe('saúde do layout com o acervo real', () => {
  it('não empurra nenhuma estrela com o gap fixado', () => {
    // Quando este teste falhar, é hora de subir TIMELINE.gapPxPerDay — num
    // commit explícito, não sozinho em tempo de execução.
    const health = layoutHealth(placeStars(PUBLICATIONS));
    expect(health.pushedRatio).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';

import { countByCategory, dimmedStars, filterStars, matches, normalize } from './filter';
import type { SearchableStar } from './filter';

const STARS: readonly SearchableStar[] = [
  {
    slug: 'pg-idx',
    category: 'estudo',
    title: 'Fundamentos de índices no PostgreSQL',
    summary: 'Quando um índice ajuda e como ler um EXPLAIN sem adivinhar.',
    categoryLabel: 'Estudo',
    dateLabel: 'FEV 2024',
  },
  {
    slug: 'n1',
    category: 'artigo',
    title: 'N+1: o custo invisível do Eloquent',
    summary: 'Como consultas aninhadas derrubam a performance de telas simples.',
    categoryLabel: 'Artigo técnico',
    dateLabel: 'MAI 2024',
  },
  {
    slug: 'logi',
    category: 'projeto',
    title: 'Dashboard de logística em tempo real',
    summary: 'Painel operacional com websockets, filas e um modelo de dados robusto.',
    categoryLabel: 'Projeto',
    dateLabel: 'AGO 2024',
  },
];

const all = (query = '', category: 'all' | SearchableStar['category'] = 'all') =>
  filterStars(STARS, { category, query });

describe('normalize', () => {
  it('rebaixa a caixa e remove acentos', () => {
    expect(normalize('Índice ÀÇÃO')).toBe('indice acao');
  });

  it('é idempotente', () => {
    expect(normalize(normalize('Órgão'))).toBe(normalize('Órgão'));
  });
});

describe('matches', () => {
  const star = STARS[0];
  if (!star) throw new Error('fixture vazia');

  it('encontra pelo título', () => {
    expect(matches(star, { category: 'all', query: 'PostgreSQL' })).toBe(true);
  });

  it('encontra pelo resumo', () => {
    expect(matches(star, { category: 'all', query: 'EXPLAIN' })).toBe(true);
  });

  it('encontra pelo rótulo da categoria', () => {
    expect(matches(star, { category: 'all', query: 'estudo' })).toBe(true);
  });

  it('encontra pela data', () => {
    expect(matches(star, { category: 'all', query: 'fev 2024' })).toBe(true);
  });

  it('ignora a caixa', () => {
    expect(matches(star, { category: 'all', query: 'postgresql' })).toBe(true);
  });

  it('acha "índice" digitando "indice"', () => {
    // Quem busca em português raramente digita o acento; o protótipo fazia
    // includes cru e não achava.
    expect(matches(star, { category: 'all', query: 'indice' })).toBe(true);
  });

  it('acha "indice" digitando "índice"', () => {
    expect(matches(star, { category: 'all', query: 'índíce' })).toBe(true);
  });

  it('não inventa resultado', () => {
    expect(matches(star, { category: 'all', query: 'kubernetes' })).toBe(false);
  });
});

describe('filterStars', () => {
  it('sem critério devolve tudo, na ordem recebida', () => {
    expect(all()).toEqual(['pg-idx', 'n1', 'logi']);
  });

  it('busca só com espaços conta como busca vazia', () => {
    expect(all('   ')).toHaveLength(3);
  });

  it('filtra por categoria', () => {
    expect(all('', 'projeto')).toEqual(['logi']);
  });

  it('combina categoria e busca', () => {
    expect(all('dashboard', 'projeto')).toEqual(['logi']);
    expect(all('dashboard', 'estudo')).toEqual([]);
  });

  it('devolve vazio quando nada corresponde', () => {
    expect(all('rust')).toEqual([]);
  });

  it('lida com conjunto vazio', () => {
    expect(filterStars([], { category: 'all', query: 'x' })).toEqual([]);
  });
});

describe('countByCategory', () => {
  it('conta por categoria e o total em "all"', () => {
    expect(countByCategory(STARS)).toEqual({
      all: 3,
      artigo: 1,
      projeto: 1,
      estudo: 1,
      rotina: 0,
    });
  });

  it('zera todas as categorias num conjunto vazio', () => {
    expect(countByCategory([])).toEqual({ all: 0, artigo: 0, projeto: 0, estudo: 0, rotina: 0 });
  });
});

describe('dimmedStars', () => {
  it('sem critério nenhuma estrela apaga', () => {
    expect(dimmedStars(STARS, { category: 'all', query: '' }).size).toBe(0);
  });

  it('apaga exatamente o complemento dos resultados', () => {
    const criteria = { category: 'all' as const, query: 'eloquent' };
    const acesas = new Set(filterStars(STARS, criteria));
    const apagadas = dimmedStars(STARS, criteria);

    expect(apagadas.size).toBe(STARS.length - acesas.size);
    for (const star of STARS) {
      expect(apagadas.has(star.slug)).toBe(!acesas.has(star.slug));
    }
  });

  it('uma busca sem resultado apaga tudo, em vez de esvaziar a constelação', () => {
    const apagadas = dimmedStars(STARS, { category: 'all', query: 'zzzz' });
    expect(apagadas.size).toBe(STARS.length);
  });

  it('o filtro de categoria também apaga', () => {
    const apagadas = dimmedStars(STARS, { category: 'estudo', query: '' });
    for (const star of STARS) {
      expect(apagadas.has(star.slug)).toBe(star.category !== 'estudo');
    }
  });
});

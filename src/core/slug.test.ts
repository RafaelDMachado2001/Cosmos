import { describe, expect, it } from 'vitest';

import { slugify } from './slug';

describe('slugify', () => {
  it('troca espaços por hífen e vira minúsculo', () => {
    expect(slugify('Code Review Sem Atrito')).toBe('code-review-sem-atrito');
  });

  it('remove acentos', () => {
    expect(slugify('Índices no PostgreSQL')).toBe('indices-no-postgresql');
  });

  it('colapsa pontuação em um hífen só', () => {
    expect(slugify('O que é "Progressive Enhancement"?')).toBe('o-que-e-progressive-enhancement');
  });

  it('não começa nem termina com hífen', () => {
    expect(slugify('  -Título-  ')).toBe('titulo');
  });
});

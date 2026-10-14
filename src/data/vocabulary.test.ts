import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { CATEGORIES, LOCALES } from '../core/types';

/**
 * O config do backend e gerado deste vocabulario por `npm run emit:seed`.
 *
 * Mudar `core/types.ts` sem emitir de novo deixaria a API validando contra a
 * lista velha — e o erro so apareceria como 422 em producao.
 */
describe('backend/config/publications.php', () => {
  const config = readFileSync('backend/config/publications.php', 'utf8');
  const quoted = (items: readonly string[]) => items.map((item) => `'${item}'`).join(', ');

  it('traz os mesmos idiomas, na mesma ordem', () => {
    expect(config).toContain(`'locales' => [${quoted(LOCALES)}]`);
  });

  it('traz as mesmas categorias, na mesma ordem', () => {
    expect(config).toContain(`'categories' => [${quoted(CATEGORIES)}]`);
  });

  it('tem dicionario para cada idioma', () => {
    const dictionaries = config.slice(config.indexOf("'dictionaries'"));
    for (const locale of LOCALES) expect(dictionaries).toContain(`'${locale}' => '`);
  });
});

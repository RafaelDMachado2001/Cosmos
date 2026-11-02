import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { CATEGORIES, LOCALES } from '../core/types';

describe('backend/config/publications.php', () => {
  const config = readFileSync('backend/config/publications.php', 'utf8');
  const quoted = (items: readonly string[]) => items.map((item) => `'${item}'`).join(', ');

  it('traz os mesmos idiomas, na mesma ordem', () => {
    expect(config).toContain(`'locales' => [${quoted(LOCALES)}]`);
  });

  it('traz as mesmas categorias, na mesma ordem', () => {
    expect(config).toContain(`'categories' => [${quoted(CATEGORIES)}]`);
  });

  it('tem dicionário para cada idioma', () => {
    const dictionaries = config.slice(config.indexOf("'dictionaries'"));
    for (const locale of LOCALES) expect(dictionaries).toContain(`'${locale}' => '`);
  });
});

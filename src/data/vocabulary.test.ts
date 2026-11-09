import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { COMMENT_MAX_LENGTH } from '../core/comments';
import { DIAGRAM_SOURCE_MAX_LENGTH } from '../core/diagram/parse';
import { HANDLE_PATTERN, NAME_MAX_LENGTH } from '../core/session';
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

describe('backend/config/community.php', () => {
  it('traz o mesmo teto de caracteres do comentário', () => {
    const config = readFileSync('backend/config/community.php', 'utf8');
    expect(config).toContain(`'comment_max_length' => ${String(COMMENT_MAX_LENGTH)},`);
  });
});

describe('backend/config/diagrams.php', () => {
  it('traz o mesmo teto de caracteres da fonte do diagrama', () => {
    const config = readFileSync('backend/config/diagrams.php', 'utf8');
    expect(config).toContain(`'source_max_length' => ${String(DIAGRAM_SOURCE_MAX_LENGTH)},`);
  });
});

describe('regras do perfil', () => {
  it('o formato do @handle é o mesmo do servidor', () => {
    const handle = readFileSync('backend/app/Modules/Identity/Support/Handle.php', 'utf8');
    expect(handle).toContain(`PATTERN = '/${HANDLE_PATTERN.source}/';`);
  });

  it('o teto do nome é o mesmo da validação do servidor', () => {
    const controller = readFileSync(
      'backend/app/Modules/Identity/Http/Controllers/MeController.php',
      'utf8',
    );
    expect(controller).toContain(`'max:${String(NAME_MAX_LENGTH)}'`);
  });
});

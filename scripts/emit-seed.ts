import { writeFileSync } from 'node:fs';

import { CATEGORIES, LOCALES } from '../src/core/types';
import type { Locale } from '../src/core/types';
import { PUBLICATIONS } from '../src/data/publications';

const rows = PUBLICATIONS.map((publication) => ({
  slug: publication.slug,
  category: publication.category,
  published_at: publication.publishedAt,
  featured: publication.featured === true,
  translations: LOCALES.map((locale) => ({
    locale,
    title: publication.content[locale].title,
    summary: publication.content[locale].summary,
    body: publication.content[locale].body.join('\n\n'),
  })),
}));

writeFileSync('backend/database/seeders/publications.json', `${JSON.stringify(rows, null, 2)}\n`);
console.log(`${String(rows.length)} publicações emitidas`);

/**
 * O dicionário de full-text do Postgres para cada idioma.
 *
 * Mora aqui e não em `core/types.ts` porque só o banco o usa. O `Record` é o que
 * impede um idioma novo de chegar ao backend sem dicionário: o typecheck quebra
 * antes.
 */
const DICTIONARIES = { pt: 'portuguese', en: 'english' } satisfies Record<Locale, string>;

const list = (items: readonly string[]): string => items.map((item) => `'${item}'`).join(', ');

const config = `<?php

// GERADO por \`npm run emit:seed\` a partir de src/core/types.ts. Nao editar:
// a proxima emissao sobrescreve. O vocabulario tem fonte unica no frontend, e
// a paridade e o que torna a troca de adapter invisivel.
//
// Excecao congelada: o CASE da migration create_publication_translations_table
// repete pt/en e os dicionarios. Migration aplicada nao se reescreve.

declare(strict_types=1);

return [
    'locales' => [${list(LOCALES)}],
    'categories' => [${list(CATEGORIES)}],
    'dictionaries' => [
${LOCALES.map((locale) => `        '${locale}' => '${DICTIONARIES[locale]}',`).join('\n')}
    ],
];
`;

writeFileSync('backend/config/publications.php', config);
console.log('vocabulário emitido em backend/config/publications.php');

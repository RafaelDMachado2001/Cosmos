import { writeFileSync } from 'node:fs';

import { COMMENT_MAX_LENGTH } from '../src/core/comments';
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
    body: publication.content[locale].body,
  })),
}));

writeFileSync('backend/database/seeders/publications.json', `${JSON.stringify(rows, null, 2)}\n`);
console.log(`${String(rows.length)} publicações emitidas`);

const DICTIONARIES = { pt: 'portuguese', en: 'english' } satisfies Record<Locale, string>;

const list = (items: readonly string[]): string => items.map((item) => `'${item}'`).join(', ');

const config = `<?php

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

writeFileSync(
  'backend/config/community.php',
  `<?php

declare(strict_types=1);

return [
    'comment_max_length' => ${String(COMMENT_MAX_LENGTH)},
];
`,
);
console.log('limites emitidos em backend/config/community.php');

import { writeFileSync } from 'node:fs';
import { PUBLICATIONS } from '../src/data/publications';

const rows = PUBLICATIONS.map((publication) => ({
  slug: publication.slug,
  category: publication.category,
  published_at: publication.publishedAt,
  featured: publication.featured === true,
  translations: (['pt', 'en'] as const).map((locale) => ({
    locale,
    title: publication.content[locale].title,
    summary: publication.content[locale].summary,
    body: publication.content[locale].body.join('\n\n'),
  })),
}));

writeFileSync('backend/database/seeders/publications.json', `${JSON.stringify(rows, null, 2)}\n`);
console.log(`${String(rows.length)} publicações emitidas`);

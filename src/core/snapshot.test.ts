import { describe, expect, it } from 'vitest';

import { parseSnapshot, serializeSnapshot, snapshotPath } from './snapshot';
import type { PublicationSummary } from './types';

const SUMMARY: PublicationSummary = {
  slug: 'code-review-sem-atrito',
  publishedAt: '2025-09-12T12:00:00.000Z',
  category: 'rotina',
  featured: false,
  title: 'Code review sem atrito',
  summary: 'Comentar o código, não a pessoa.',
};

describe('snapshotPath', () => {
  it('um arquivo por idioma, na raiz do site', () => {
    expect(snapshotPath('pt')).toBe('/data/publications.pt.json');
    expect(snapshotPath('en')).toBe('/data/publications.en.json');
  });
});

describe('parseSnapshot', () => {
  it('lê de volta o que serializeSnapshot grava', () => {
    const items = [SUMMARY, { ...SUMMARY, slug: 'outra', updatedAt: SUMMARY.publishedAt }];
    expect(parseSnapshot(JSON.parse(serializeSnapshot(items)))).toEqual(items);
  });

  it('aceita o acervo vazio', () => {
    expect(parseSnapshot([])).toEqual([]);
  });

  it('recusa o que não é lista', () => {
    expect(parseSnapshot({ data: [SUMMARY] })).toBeNull();
    expect(parseSnapshot(null)).toBeNull();
  });

  it('uma linha inválida descarta o arquivo inteiro', () => {
    expect(parseSnapshot([SUMMARY, { ...SUMMARY, category: 'receita' }])).toBeNull();
    expect(parseSnapshot([SUMMARY, { ...SUMMARY, publishedAt: 'ontem' }])).toBeNull();
    expect(parseSnapshot([SUMMARY, { ...SUMMARY, title: undefined }])).toBeNull();
    expect(parseSnapshot([SUMMARY, { ...SUMMARY, featured: 'sim' }])).toBeNull();
  });
});

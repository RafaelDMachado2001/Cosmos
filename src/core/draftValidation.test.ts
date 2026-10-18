import { describe, expect, it } from 'vitest';

import { validateDraftBlock, validateDraftBlocks, wordCount } from './draftValidation';
import type { DraftBlock } from './draftBlocks';

describe('wordCount', () => {
  it('soma palavras de parágrafos, títulos e citações', () => {
    const blocks: readonly DraftBlock[] = [
      { id: 'b0', type: 'h2', text: 'Duas palavras' },
      { id: 'b1', type: 'p', text: 'Um parágrafo com cinco palavras.' },
    ];
    expect(wordCount(blocks)).toBe(2 + 5);
  });

  it('conta cada item de lista', () => {
    const blocks: readonly DraftBlock[] = [
      { id: 'b0', type: 'list', ordered: false, items: ['um item', 'outro item aqui'] },
    ];
    expect(wordCount(blocks)).toBe(2 + 3);
  });

  it('código não conta como prosa', () => {
    const blocks: readonly DraftBlock[] = [
      { id: 'b0', type: 'code', lang: 'ts', text: 'const muitas = palavras aqui dentro' },
    ];
    expect(wordCount(blocks)).toBe(0);
  });

  it('conta o alt da imagem', () => {
    const blocks: readonly DraftBlock[] = [
      { id: 'b0', type: 'img', url: '/x.png', mediaId: null, alt: 'três palavras aqui', caption: null },
    ];
    expect(wordCount(blocks)).toBe(3);
  });

  it('lista vazia de blocos conta zero', () => {
    expect(wordCount([])).toBe(0);
  });
});

describe('validateDraftBlock', () => {
  it('parágrafo vazio é inválido', () => {
    expect(validateDraftBlock({ id: 'b0', type: 'p', text: '  ' })).not.toBeNull();
  });

  it('parágrafo com texto é válido', () => {
    expect(validateDraftBlock({ id: 'b0', type: 'p', text: 'Olá.' })).toBeNull();
  });

  it('lista sem itens é inválida', () => {
    expect(validateDraftBlock({ id: 'b0', type: 'list', ordered: false, items: [] })).not.toBeNull();
  });

  it('lista com item vazio é inválida', () => {
    expect(
      validateDraftBlock({ id: 'b0', type: 'list', ordered: false, items: ['ok', '  '] }),
    ).not.toBeNull();
  });

  it('imagem sem alt é inválida', () => {
    expect(
      validateDraftBlock({ id: 'b0', type: 'img', url: '/x.png', mediaId: null, alt: '', caption: null }),
    ).not.toBeNull();
  });

  it('imagem com URL insegura é inválida', () => {
    expect(
      validateDraftBlock({
        id: 'b0',
        type: 'img',
        url: 'javascript:alert(1)',
        mediaId: null,
        alt: 'alt',
        caption: null,
      }),
    ).not.toBeNull();
  });

  it('imagem válida', () => {
    expect(
      validateDraftBlock({
        id: 'b0',
        type: 'img',
        url: 'https://example.com/a.png',
        mediaId: null,
        alt: 'alt',
        caption: null,
      }),
    ).toBeNull();
  });
});

describe('validateDraftBlocks', () => {
  it('devolve um erro por bloco inválido, com o id certo', () => {
    const blocks: readonly DraftBlock[] = [
      { id: 'ok', type: 'p', text: 'Texto.' },
      { id: 'vazio', type: 'p', text: '' },
    ];
    const errors = validateDraftBlocks(blocks);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.id).toBe('vazio');
  });

  it('sem blocos inválidos, devolve lista vazia', () => {
    expect(validateDraftBlocks([{ id: 'b0', type: 'p', text: 'Texto.' }])).toEqual([]);
  });
});

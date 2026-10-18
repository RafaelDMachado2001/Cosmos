import { describe, expect, it } from 'vitest';

import { blocksToDraftBlocks, draftBlocksToMarkdown } from './draftBlocks';
import type { DraftBlock } from './draftBlocks';

describe('blocksToDraftBlocks', () => {
  it('converte cada tipo de bloco, com ids estáveis por posição', () => {
    const markdown = [
      '## Intertítulo',
      '',
      'Um parágrafo com **negrito** e `código`.',
      '',
      '> Uma citação.',
      '',
      '- Primeiro',
      '- Segundo',
      '',
      '```ts',
      "const x = 1;",
      '```',
      '',
      '![a constelação](https://example.com/a.png "Figura 1")',
    ].join('\n');

    expect(blocksToDraftBlocks(markdown)).toEqual<readonly DraftBlock[]>([
      { id: 'b0', type: 'h2', text: 'Intertítulo' },
      { id: 'b1', type: 'p', text: 'Um parágrafo com **negrito** e `código`.' },
      { id: 'b2', type: 'quote', text: 'Uma citação.' },
      { id: 'b3', type: 'list', ordered: false, items: ['Primeiro', 'Segundo'] },
      { id: 'b4', type: 'code', lang: 'ts', text: "const x = 1;" },
      {
        id: 'b5',
        type: 'img',
        url: 'https://example.com/a.png',
        mediaId: null,
        alt: 'a constelação',
        caption: 'Figura 1',
      },
    ]);
  });

  it('nível 3 de título sobrevive', () => {
    const [block] = blocksToDraftBlocks('### Sub');
    expect(block).toEqual<DraftBlock>({ id: 'b0', type: 'h3', text: 'Sub' });
  });

  it('lista ordenada marca ordered: true', () => {
    const [block] = blocksToDraftBlocks('1. Um\n2. Dois');
    expect(block).toEqual<DraftBlock>({
      id: 'b0',
      type: 'list',
      ordered: true,
      items: ['Um', 'Dois'],
    });
  });

  it('imagem sem legenda vira caption null', () => {
    const [block] = blocksToDraftBlocks('![alt](https://example.com/x.png)');
    expect(block).toEqual<DraftBlock>({
      id: 'b0',
      type: 'img',
      url: 'https://example.com/x.png',
      mediaId: null,
      alt: 'alt',
      caption: null,
    });
  });
});

describe('draftBlocksToMarkdown', () => {
  it('cada tipo vira a sintaxe esperada', () => {
    const blocks: readonly DraftBlock[] = [
      { id: 'b0', type: 'h2', text: 'Título' },
      { id: 'b1', type: 'p', text: 'Parágrafo com **negrito**.' },
      { id: 'b2', type: 'quote', text: 'Citação.' },
      { id: 'b3', type: 'list', ordered: true, items: ['Um', 'Dois'] },
      { id: 'b4', type: 'code', lang: 'ts', text: 'const x = 1;' },
      {
        id: 'b5',
        type: 'img',
        url: 'https://example.com/a.png',
        mediaId: 7,
        alt: 'alt',
        caption: 'legenda',
      },
    ];

    expect(draftBlocksToMarkdown(blocks)).toBe(
      [
        '## Título',
        'Parágrafo com **negrito**.',
        '> Citação.',
        '1. Um\n2. Dois',
        '```ts\nconst x = 1;\n```',
        '![alt](https://example.com/a.png "legenda")',
      ].join('\n\n'),
    );
  });

  it('imagem sem legenda não escreve aspas vazias', () => {
    const markdown = draftBlocksToMarkdown([
      { id: 'b0', type: 'img', url: '/x.png', mediaId: null, alt: 'alt', caption: null },
    ]);
    expect(markdown).toBe('![alt](/x.png)');
  });

  it('round-trip: markdown -> blocos -> markdown reproduz o mesmo texto', () => {
    const original = [
      '## Como este texto chega até aqui',
      'Um parágrafo com **negrito**, *itálico* e [um link](https://example.com/a).',
      '> Uma citação qualquer.',
      '- Primeiro item\n- Segundo item',
      '```ts\nconst blocos = parseBlocks(corpo);\n```',
      '![a constelação](https://example.com/a.png "Figura 1")',
    ].join('\n\n');

    expect(draftBlocksToMarkdown(blocksToDraftBlocks(original))).toBe(original);
  });
});

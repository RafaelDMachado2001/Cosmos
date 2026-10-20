import { describe, expect, it } from 'vitest';

import { parseBlocks } from './blocks';
import type { Block } from './blocks';
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

/**
 * O que o autor vê no editor tem de ser o que o leitor vê: cada bloco, depois
 * de virar Markdown e ser lido de volta por `parseBlocks` (o mesmo caminho da
 * página pública), continua sendo um bloco só, do mesmo tipo e com o mesmo
 * conteúdo. Cada caso aqui quebrava antes: o texto do autor era lido como
 * sintaxe de outro bloco.
 */
describe('fidelidade: rascunho -> Markdown -> leitura', () => {
  const read = (blocks: readonly DraftBlock[]): readonly Block[] =>
    parseBlocks(draftBlocksToMarkdown(blocks));
  const paragraph = (value: string): Block => ({ type: 'paragraph', children: [{ type: 'text', text: value }] });

  it.each([
    ['1984. Foi o ano.', 'número seguido de ponto não vira lista numerada'],
    ['- não é lista', 'hífen no começo não vira lista'],
    ['* nem isto', 'asterisco no começo não vira lista'],
    ['## não é título', 'cerquilha no começo não vira intertítulo'],
    ['> não é citação', 'sinal de maior no começo não vira citação'],
    ['```não é código', 'crase tripla no começo não abre bloco de código'],
  ])('parágrafo "%s": %s', (value) => {
    expect(read([{ id: 'b0', type: 'p', text: value }])).toEqual([paragraph(value)]);
  });

  it('tabela: alinhamento, barra e quebra de linha nas células, linha torta', () => {
    const table: DraftBlock = {
      id: 'b0',
      type: 'table',
      align: ['left', null, 'right'],
      header: ['Nome', 'Expressão', 'Valor'],
      rows: [
        ['a', '`x | y`', '1'],
        ['quebra\nde linha', 'c | d', ''],
      ],
    };
    const [back] = read([table]);
    expect(back?.type).toBe('table');
    expect(blocksToDraftBlocks(draftBlocksToMarkdown([table]))).toEqual([
      { ...table, rows: [['a', '`x | y`', '1'], ['quebra de linha', 'c | d', '']] },
    ]);
  });

  it('parágrafo com linha em branco continua um parágrafo só', () => {
    expect(read([{ id: 'b0', type: 'p', text: 'Primeira.\n\nSegunda.' }])).toEqual([
      paragraph('Primeira. Segunda.'),
    ]);
  });

  it('linha de parágrafo que parece outro bloco não o divide', () => {
    expect(
      read([
        { id: 'b0', type: 'p', text: 'Antes\n- item\n```\n## x' },
        { id: 'b1', type: 'h2', text: 'Depois' },
      ]),
    ).toEqual<readonly Block[]>([
      paragraph('Antes - item ``` ## x'),
      { type: 'heading', level: 2, children: [{ type: 'text', text: 'Depois' }] },
    ]);
  });

  it('intertítulo com quebra de linha continua um intertítulo', () => {
    expect(read([{ id: 'b0', type: 'h2', text: 'Título\nquebrado' }])).toEqual<readonly Block[]>([
      { type: 'heading', level: 2, children: [{ type: 'text', text: 'Título quebrado' }] },
    ]);
  });

  it('item de lista com quebra de linha continua um item', () => {
    expect(
      read([{ id: 'b0', type: 'list', ordered: false, items: ['um\n- dois', 'três'] }]),
    ).toEqual<readonly Block[]>([
      {
        type: 'list',
        ordered: false,
        items: [[{ type: 'text', text: 'um - dois' }], [{ type: 'text', text: 'três' }]],
      },
    ]);
  });

  it('código que contém cercas não fecha antes da hora nem engole o bloco seguinte', () => {
    const code = 'Exemplo:\n```ts\nconst x = 1;\n```\n````\nfim';
    expect(
      read([
        { id: 'b0', type: 'code', lang: 'md', text: code },
        { id: 'b1', type: 'p', text: 'Depois.' },
      ]),
    ).toEqual<readonly Block[]>([{ type: 'code', code, language: 'md' }, paragraph('Depois.')]);
  });

  it('imagem com colchete no alt, parêntese na URL e aspas na legenda', () => {
    expect(
      read([
        {
          id: 'b0',
          type: 'img',
          url: 'https://example.com/wiki/Nebulosa_(astronomia) a.png',
          mediaId: null,
          alt: 'a [grande] nebulosa',
          caption: 'Foto "real" \\o/',
        },
      ]),
    ).toEqual<readonly Block[]>([
      {
        type: 'image',
        src: 'https://example.com/wiki/Nebulosa_%28astronomia%29%20a.png',
        alt: 'a [grande] nebulosa',
        caption: 'Foto "real" \\o/',
      },
    ]);
  });

  it('formatação em linha passa intacta', () => {
    expect(read([{ id: 'b0', type: 'p', text: '1. Com **negrito**, `código` e [link](/a).' }])).toEqual<
      readonly Block[]
    >([
      {
        type: 'paragraph',
        children: [
          { type: 'text', text: '1. Com ' },
          { type: 'strong', children: [{ type: 'text', text: 'negrito' }] },
          { type: 'text', text: ', ' },
          { type: 'code', text: 'código' },
          { type: 'text', text: ' e ' },
          { type: 'link', href: '/a', children: [{ type: 'text', text: 'link' }] },
          { type: 'text', text: '.' },
        ],
      },
    ]);
  });

  it('importar Markdown com escape preserva o texto literal', () => {
    const blocks = blocksToDraftBlocks('Um \\*asterisco\\* literal.');
    expect(read(blocks)).toEqual([paragraph('Um *asterisco* literal.')]);
  });
});

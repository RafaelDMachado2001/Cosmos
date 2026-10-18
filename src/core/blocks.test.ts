import { describe, expect, it } from 'vitest';

import { parseBlocks } from './blocks';
import type { Block, InlineNode } from './blocks';

const text = (value: string): InlineNode => ({ type: 'text', text: value });

describe('parseBlocks', () => {
  it('markdown vazio não produz blocos', () => {
    expect(parseBlocks('')).toEqual([]);
    expect(parseBlocks('   \n\n  ')).toEqual([]);
  });

  it('um parágrafo simples', () => {
    expect(parseBlocks('Olá mundo.')).toEqual<readonly Block[]>([
      { type: 'paragraph', children: [text('Olá mundo.')] },
    ]);
  });

  it('parágrafos separados por linha em branco, como antes', () => {
    const blocks = parseBlocks('Primeiro.\n\nSegundo.\n\nTerceiro.');
    expect(blocks).toHaveLength(3);
    expect(blocks.every((block) => block.type === 'paragraph')).toBe(true);
  });

  it('um parágrafo de múltiplas linhas colapsa em uma só, como markdown', () => {
    const blocks = parseBlocks('Linha um\nlinha dois.');
    expect(blocks).toEqual<readonly Block[]>([
      { type: 'paragraph', children: [text('Linha um linha dois.')] },
    ]);
  });

  it('título de seção nível 2 e 3', () => {
    expect(parseBlocks('## Título')).toEqual<readonly Block[]>([
      { type: 'heading', level: 2, children: [text('Título')] },
    ]);
    expect(parseBlocks('### Subtítulo')).toEqual<readonly Block[]>([
      { type: 'heading', level: 3, children: [text('Subtítulo')] },
    ]);
  });

  it('citação de uma ou mais linhas', () => {
    expect(parseBlocks('> Uma citação.')).toEqual<readonly Block[]>([
      { type: 'quote', children: [text('Uma citação.')] },
    ]);
    expect(parseBlocks('> Linha um\n> linha dois.')).toEqual<readonly Block[]>([
      { type: 'quote', children: [text('Linha um linha dois.')] },
    ]);
  });

  it('lista sem marcador', () => {
    expect(parseBlocks('- Primeiro\n- Segundo\n- Terceiro')).toEqual<readonly Block[]>([
      {
        type: 'list',
        ordered: false,
        items: [[text('Primeiro')], [text('Segundo')], [text('Terceiro')]],
      },
    ]);
  });

  it('lista numerada', () => {
    expect(parseBlocks('1. Primeiro\n2. Segundo')).toEqual<readonly Block[]>([
      { type: 'list', ordered: true, items: [[text('Primeiro')], [text('Segundo')]] },
    ]);
  });

  it('lista para na primeira linha que não casa o marcador', () => {
    const blocks = parseBlocks('- Um\n- Dois\n\nDepois da lista.');
    expect(blocks).toEqual<readonly Block[]>([
      { type: 'list', ordered: false, items: [[text('Um')], [text('Dois')]] },
      { type: 'paragraph', children: [text('Depois da lista.')] },
    ]);
  });

  it('bloco de código preserva linha em branco interna e indentação', () => {
    const markdown = ['```ts', 'function soma(a, b) {', '', '  return a + b;', '}', '```'].join(
      '\n',
    );
    expect(parseBlocks(markdown)).toEqual<readonly Block[]>([
      {
        type: 'code',
        language: 'ts',
        code: 'function soma(a, b) {\n\n  return a + b;\n}',
      },
    ]);
  });

  it('bloco de código sem linguagem declarada', () => {
    expect(parseBlocks('```\nplain\n```')).toEqual<readonly Block[]>([
      { type: 'code', language: null, code: 'plain' },
    ]);
  });

  it('bloco de código sem fechamento consome até o fim, não quebra', () => {
    expect(parseBlocks('```\nsem fechamento')).toEqual<readonly Block[]>([
      { type: 'code', language: null, code: 'sem fechamento' },
    ]);
  });

  it('imagem isolada numa linha', () => {
    expect(parseBlocks('![um gráfico](https://example.com/a.png "legenda")')).toEqual<
      readonly Block[]
    >([
      {
        type: 'image',
        src: 'https://example.com/a.png',
        alt: 'um gráfico',
        caption: 'legenda',
      },
    ]);
  });

  it('imagem sem legenda', () => {
    expect(parseBlocks('![alt](/local.png)')).toEqual<readonly Block[]>([
      { type: 'image', src: '/local.png', alt: 'alt', caption: null },
    ]);
  });

  describe('inline', () => {
    it('negrito, itálico e código', () => {
      const [block] = parseBlocks('Texto **forte**, *leve* e `codigo`.');
      expect(block).toEqual<Block>({
        type: 'paragraph',
        children: [
          text('Texto '),
          { type: 'strong', children: [text('forte')] },
          text(', '),
          { type: 'em', children: [text('leve')] },
          text(' e '),
          { type: 'code', text: 'codigo' },
          text('.'),
        ],
      });
    });

    it('itálico com sublinhado', () => {
      const [block] = parseBlocks('Uma _palavra_ só.');
      expect(block).toEqual<Block>({
        type: 'paragraph',
        children: [text('Uma '), { type: 'em', children: [text('palavra')] }, text(' só.')],
      });
    });

    it('link com protocolo aceito', () => {
      const [block] = parseBlocks('Veja [este artigo](https://example.com/a).');
      expect(block).toEqual<Block>({
        type: 'paragraph',
        children: [
          text('Veja '),
          { type: 'link', href: 'https://example.com/a', children: [text('este artigo')] },
          text('.'),
        ],
      });
    });

    it('link raiz-relativo e âncora são aceitos', () => {
      const [a] = parseBlocks('[home](/pt)');
      const [b] = parseBlocks('[topo](#topo)');
      expect(a).toEqual<Block>({
        type: 'paragraph',
        children: [{ type: 'link', href: '/pt', children: [text('home')] }],
      });
      expect(b).toEqual<Block>({
        type: 'paragraph',
        children: [{ type: 'link', href: '#topo', children: [text('topo')] }],
      });
    });

    it('link com protocolo recusado sobra como texto, nunca é descartado', () => {
      const [block] = parseBlocks('[clique aqui](javascript:alert)');
      expect(block).toEqual<Block>({
        type: 'paragraph',
        children: [text('clique aqui')],
      });
    });

    it.each(['data:text/html,<script>', 'vbscript:msgbox', 'file:///etc/passwd'])(
      'protocolo %s também é recusado, não só javascript:',
      (href) => {
        const [block] = parseBlocks(`[clique aqui](${href})`);
        expect(block).toEqual<Block>({
          type: 'paragraph',
          children: [text('clique aqui')],
        });
      },
    );

    it('imagem com URL vazia sobra como o alt, não é descartada', () => {
      const [block] = parseBlocks('![legenda]()');
      expect(block).toEqual<Block>({
        type: 'paragraph',
        children: [text('legenda')],
      });
    });

    it('imagem embutida no meio de um parágrafo sempre sobra como o alt', () => {
      // A spec trata imagem como bloco, não como marca inline — a sintaxe
      // `![alt](...)` no meio de um parágrafo nunca vira figura, só o alt.
      const [block] = parseBlocks('Antes ![x](javascript:alert) depois.');
      expect(block).toEqual<Block>({
        type: 'paragraph',
        children: [text('Antes x depois.')],
      });
    });

    it('nada de HTML embutido: tags sobrevivem como texto literal', () => {
      const [block] = parseBlocks('Isto é <b>negrito</b> de verdade?');
      expect(block).toEqual<Block>({
        type: 'paragraph',
        children: [text('Isto é <b>negrito</b> de verdade?')],
      });
    });
  });

  it('um artigo completo mistura os seis tipos de bloco', () => {
    const markdown = [
      '## Introdução',
      '',
      'Um parágrafo com **destaque**.',
      '',
      '> Uma citação importante.',
      '',
      '- Primeiro ponto',
      '- Segundo ponto',
      '',
      '```js',
      "console.log('oi');",
      '```',
      '',
      '![diagrama](https://example.com/d.png "Figura 1")',
    ].join('\n');

    const blocks = parseBlocks(markdown);

    expect(blocks.map((block) => block.type)).toEqual([
      'heading',
      'paragraph',
      'quote',
      'list',
      'code',
      'image',
    ]);
  });
});

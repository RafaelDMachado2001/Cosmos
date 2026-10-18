import { describe, expect, it } from 'vitest';

import { highlight } from './highlight';
import type { CodeToken } from './highlight';

const joined = (tokens: readonly CodeToken[]): string => tokens.map((token) => token.text).join('');
const kinds = (tokens: readonly CodeToken[], kind: CodeToken['kind']): readonly string[] =>
  tokens.filter((token) => token.kind === kind).map((token) => token.text);

describe('highlight', () => {
  it('linguagem ausente ou desconhecida devolve o código como um token plain', () => {
    expect(highlight('x = 1', null)).toEqual([{ kind: 'plain', text: 'x = 1' }]);
    expect(highlight('MOVE 1 TO X.', 'cobol')).toEqual([{ kind: 'plain', text: 'MOVE 1 TO X.' }]);
    expect(highlight('', 'ts')).toEqual([]);
  });

  it('typescript: palavra-chave, texto, número e comentário', () => {
    const code = 'const total = soma("a", 42); // fim\n/* bloco */ return `t`;';
    const tokens = highlight(code, 'ts');

    expect(joined(tokens)).toBe(code);
    expect(kinds(tokens, 'keyword')).toEqual(['const', 'return']);
    expect(kinds(tokens, 'string')).toEqual(['"a"', '`t`']);
    expect(kinds(tokens, 'number')).toEqual(['42']);
    expect(kinds(tokens, 'comment')).toEqual(['// fim', '/* bloco */']);
  });

  it('palavra-chave dentro de texto ou comentário não é destacada', () => {
    const tokens = highlight('"const" // return', 'js');
    expect(kinds(tokens, 'keyword')).toEqual([]);
  });

  it('identificador que contém número não vira número', () => {
    expect(kinds(highlight('x1 + 2', 'ts'), 'number')).toEqual(['2']);
  });

  it('texto não fechado não engole o resto da linha', () => {
    const code = 'const a = "aberto\nconst b = 1;';
    const tokens = highlight(code, 'ts');
    expect(joined(tokens)).toBe(code);
    expect(kinds(tokens, 'keyword')).toEqual(['const', 'const']);
  });

  it('sql não diferencia maiúsculas', () => {
    expect(kinds(highlight('SELECT id FROM t -- x', 'sql'), 'keyword')).toEqual(['SELECT', 'FROM']);
    expect(kinds(highlight('select 1', 'postgres'), 'keyword')).toEqual(['select']);
  });

  it('no shell, # só comenta no começo ou depois de espaço', () => {
    const tokens = highlight('echo $# # conta', 'bash');
    expect(kinds(tokens, 'comment')).toEqual(['# conta']);
  });

  it('a concatenação dos tokens é sempre o código original', () => {
    const samples: readonly [string, string][] = [
      ['<?php\n$x = [1, 2]; # c\necho "a\\"b";', 'php'],
      ['def f(x):\n    return None  # n', 'python'],
      ['{"a": [1, true, null]}', 'json'],
      ['.a { color: red; } /* sem fim', 'css'],
    ];
    for (const [code, language] of samples) {
      expect(joined(highlight(code, language))).toBe(code);
    }
  });
});

/**
 * Syntax highlighting dos blocos de código, em tokens — nunca em HTML.
 *
 * Mesmo princípio de `core/blocks.ts`: uma gramática pequena escrita à mão,
 * em TypeScript puro, consumida igual pelo prerender (Node), pela vista de
 * leitura e pela pré-visualização do RDM Studio. Uma biblioteca (Shiki,
 * highlight.js) traria gramáticas completas e um motor de regex inteiro para
 * o bundle do cliente; aqui bastam comentário, texto, número e palavra-chave,
 * o que dá ao leitor a estrutura do código sem pretender ser um editor.
 *
 * Linguagem desconhecida ou ausente devolve o código inteiro como um token
 * `plain` — nunca uma cor errada. A concatenação dos tokens é sempre o código
 * original, caractere por caractere.
 *
 * Módulo puro: sem DOM, sem React, sem Three.
 */

export type CodeTokenKind = 'plain' | 'keyword' | 'string' | 'number' | 'comment';

export interface CodeToken {
  readonly kind: CodeTokenKind;
  readonly text: string;
}

interface Grammar {
  /** Alternativas de comentário, em ordem; cada uma um trecho de regex. */
  readonly comments: readonly string[];
  readonly strings: readonly string[];
  readonly keywords: ReadonlySet<string>;
  readonly caseInsensitive?: boolean;
}

const LINE_SLASH = String.raw`\/\/[^\n]*`;
const BLOCK_SLASH = String.raw`\/\*[\s\S]*?(?:\*\/|$)`;
/** `#` só abre comentário no começo da linha ou depois de espaço (`$#` no shell não). */
const LINE_HASH = String.raw`(?<![^\s])#[^\n]*`;
const LINE_DASH = String.raw`--[^\n]*`;

const SINGLE = String.raw`'(?:\\.|[^'\\\n])*'`;
const DOUBLE = String.raw`"(?:\\.|[^"\\\n])*"`;
const BACKTICK = String.raw`\`(?:\\.|[^\`\\])*\``;

const NUMBER = String.raw`\b(?:0[xX][0-9a-fA-F]+|\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?)\b`;
const WORD = String.raw`[A-Za-z_$][\w$]*`;

function words(list: string): ReadonlySet<string> {
  return new Set(list.split(/\s+/).filter((word) => word !== ''));
}

const JS_KEYWORDS = words(`
  as async await break case catch class const continue debugger default delete do else enum
  export extends false finally for from function if implements import in instanceof interface
  let new null of private protected public readonly return satisfies static super switch this
  throw true try type typeof undefined var void while yield
`);

const GRAMMARS: Readonly<Record<string, Grammar>> = {
  typescript: { comments: [LINE_SLASH, BLOCK_SLASH], strings: [SINGLE, DOUBLE, BACKTICK], keywords: JS_KEYWORDS },
  php: {
    comments: [LINE_SLASH, BLOCK_SLASH, LINE_HASH],
    strings: [SINGLE, DOUBLE],
    keywords: words(`
      abstract array as break case catch class const continue declare default do echo else elseif
      enum extends false final finally fn for foreach function if implements instanceof interface
      match namespace new null private protected public readonly return self static switch this
      throw trait true try use while yield
    `),
  },
  sql: {
    comments: [LINE_DASH, BLOCK_SLASH],
    strings: [SINGLE],
    caseInsensitive: true,
    keywords: words(`
      add all alter and as asc begin between by case check commit constraint create cross default
      delete desc distinct drop else end exists false foreign from full group having if in index
      inner insert into is join key left like limit not null offset on or order outer primary
      references returning right rollback select set table then true union unique update using
      values view when where with
    `),
  },
  bash: {
    comments: [LINE_HASH],
    strings: [SINGLE, DOUBLE],
    keywords: words(`
      case do done elif else esac exit export fi for function if in local return then until while
    `),
  },
  python: {
    comments: [LINE_HASH],
    strings: [SINGLE, DOUBLE],
    keywords: words(`
      and as assert async await break class continue def del elif else except False finally for
      from global if import in is lambda None nonlocal not or pass raise return True try while
      with yield
    `),
  },
  json: { comments: [], strings: [DOUBLE], keywords: words('true false null') },
  css: { comments: [BLOCK_SLASH], strings: [SINGLE, DOUBLE], keywords: words('important') },
};

const ALIASES: Readonly<Record<string, keyof typeof GRAMMARS>> = {
  ts: 'typescript',
  tsx: 'typescript',
  typescript: 'typescript',
  js: 'typescript',
  jsx: 'typescript',
  javascript: 'typescript',
  php: 'php',
  sql: 'sql',
  postgres: 'sql',
  postgresql: 'sql',
  sh: 'bash',
  bash: 'bash',
  shell: 'bash',
  zsh: 'bash',
  py: 'python',
  python: 'python',
  json: 'json',
  css: 'css',
};

const compiled = new Map<Grammar, RegExp>();

function tokenRegex(grammar: Grammar): RegExp {
  const cached = compiled.get(grammar);
  if (cached !== undefined) return cached;

  const comment = grammar.comments.length > 0 ? `(?<comment>${grammar.comments.join('|')})|` : '';
  const regex = new RegExp(
    `${comment}(?<string>${grammar.strings.join('|')})|(?<number>${NUMBER})|(?<word>${WORD})`,
    'g',
  );
  compiled.set(grammar, regex);
  return regex;
}

function grammarFor(language: string | null): Grammar | null {
  if (language === null) return null;
  const name = ALIASES[language.toLowerCase()];
  return name === undefined ? null : (GRAMMARS[name] ?? null);
}

export function highlight(code: string, language: string | null): readonly CodeToken[] {
  const grammar = grammarFor(language);
  if (grammar === null) return code === '' ? [] : [{ kind: 'plain', text: code }];

  const tokens: CodeToken[] = [];
  const push = (kind: CodeTokenKind, text: string): void => {
    if (text === '') return;
    const last = tokens[tokens.length - 1];
    if (last?.kind === kind) {
      tokens[tokens.length - 1] = { kind, text: last.text + text };
      return;
    }
    tokens.push({ kind, text });
  };

  let cursor = 0;
  for (const match of code.matchAll(tokenRegex(grammar))) {
    push('plain', code.slice(cursor, match.index));
    cursor = match.index + match[0].length;

    const groups = match.groups ?? {};
    if (groups.comment !== undefined) push('comment', match[0]);
    else if (groups.string !== undefined) push('string', match[0]);
    else if (groups.number !== undefined) push('number', match[0]);
    else {
      const word = grammar.caseInsensitive === true ? match[0].toLowerCase() : match[0];
      push(grammar.keywords.has(word) ? 'keyword' : 'plain', match[0]);
    }
  }
  push('plain', code.slice(cursor));

  return tokens;
}

import { describe, expect, it } from 'vitest';

import { REFERENCE_DIAGRAM, REFERENCE_STATES } from './fixture';
import { DIAGRAM_LIMITS, DIAGRAM_SOURCE_MAX_LENGTH, diagramErrorMessages, parseDiagram } from './parse';
import type { DiagramError, FlowDiagram } from './types';

function valid(source: string): FlowDiagram {
  const result = parseDiagram(source);
  if (!result.ok || result.diagram.kind !== 'flow') throw new Error(JSON.stringify(result));
  return result.diagram;
}

function errors(source: string): readonly DiagramError[] {
  const result = parseDiagram(source);
  if (result.ok) throw new Error('esperava erro');
  return result.errors;
}

const body = (...lines: readonly string[]): string => ['flow f', ...lines].join('\n');

describe('parseDiagram: exemplo de referência', () => {
  it('lê tipo, id, título, nós e arestas', () => {
    const diagram = valid(REFERENCE_DIAGRAM);
    expect(diagram).toMatchObject({ kind: 'flow', id: 'caminho-php', direction: 'auto' });
    expect(diagram.title).toBe('O caminho de uma request até o PHP');
    expect(diagram.nodes.map((node) => node.id)).toEqual(['navegador', 'nginx', 'disco', 'fpm', 'php']);
    expect(diagram.nodes[2]).toEqual({ id: 'disco', label: 'public/', sub: 'arquivo estático', line: 6 });
    expect(diagram.edges).toHaveLength(4);
    expect(diagram.edges[2]).toEqual({
      from: 'nginx',
      to: 'fpm',
      label: 'FastCGI · unix socket',
      short: 'FastCGI',
      line: 12,
    });
  });
});

describe('parseDiagram: sintaxe livre', () => {
  it('nó sem subtítulo e aresta sem rótulo', () => {
    const diagram = valid(body('a "A"', 'b "B"', 'a -> b'));
    expect(diagram.nodes[0]?.sub).toBeNull();
    expect(diagram.edges[0]).toMatchObject({ label: null, short: null });
  });

  it('comentários, linhas em branco e alinhamento são ignorados', () => {
    const diagram = valid(
      ['# antes de tudo', '', 'flow   f   # o fluxo', '', '   a      "A"   # nó', 'b "B"', '  a->b:rótulo  # fim'].join('\n'),
    );
    expect(diagram.id).toBe('f');
    expect(diagram.edges[0]).toMatchObject({ from: 'a', to: 'b', label: 'rótulo', line: 7 });
  });

  it('# dentro de aspas não é comentário', () => {
    expect(valid(body('a "C# # rápido" / sub # fora')).nodes[0]).toMatchObject({ label: 'C# # rápido', sub: 'sub' });
  });

  it('\\# é uma cerquilha literal, dentro e fora de aspas', () => {
    const diagram = valid(['flow f', 'title: Pedido \\#42 # comentário', 'a "C\\#"'].join('\n'));
    expect(diagram.title).toBe('Pedido #42');
    expect(diagram.nodes[0]?.label).toBe('C#');
  });

  it('direção e nós declarados depois da aresta', () => {
    const diagram = valid(body('direction: down', 'a -> b', 'a "A"', 'b "B"'));
    expect(diagram.direction).toBe('down');
    expect(diagram.edges).toHaveLength(1);
  });

  it('rótulo curto sem rótulo normal', () => {
    expect(valid(body('a "A"', 'b "B"', 'a -> b | só')).edges[0]).toMatchObject({ label: null, short: 'só' });
  });

  it('CRLF não muda os números de linha', () => {
    expect(errors('flow f\r\na "A"\r\na -> x')[0]?.line).toBe(3);
  });
});

describe('parseDiagram: erros', () => {
  it('nó não declarado sugere o parecido', () => {
    expect(errors(body('fpm "FPM"', 'nginx "N"', 'nginx -> fpn'))).toEqual([
      { line: 4, message: 'o nó "fpn" não foi declarado. Você quis dizer "fpm"?' },
    ]);
  });

  it('nó não declarado sem parecido não inventa sugestão', () => {
    expect(errors(body('fpm "FPM"', 'fpm -> zebra'))[0]?.message).toBe('o nó "zebra" não foi declarado.');
  });

  it('id repetido aponta a primeira linha', () => {
    expect(errors(body('', 'disco "A"', 'disco "B"'))).toEqual([
      { line: 4, message: 'id "disco" repetido; já declarado na linha 3' },
    ]);
  });

  it('aresta para si mesmo continua recusada', () => {
    expect(errors(body('a "A"', 'a -> a'))[0]?.message).toBe('aresta de "a" para ele mesmo não é suportada');
  });

  it('o quarto ciclo é recusado, na linha que o fecha', () => {
    const lines = ['a', 'b', 'c', 'd', 'e'].map((id) => `${id} "${id}"`);
    const forward = ['a -> b', 'b -> c', 'c -> d', 'd -> e'];
    const back = ['b -> a', 'c -> a', 'd -> a', 'e -> a'];
    expect(errors(body(...lines, ...forward, ...back))).toEqual([
      { line: 11, message: 'mais de 3 arestas fecham ciclo (a -> b -> a); o máximo é 3' },
    ]);
  });

  it('diretiva desconhecida sugere a certa', () => {
    expect(errors(['flow f', 'titulo: x', 'a "A"'].join('\n'))).toEqual([
      { line: 2, message: 'diretiva desconhecida "titulo". Use "title"' },
    ]);
  });

  it('diretiva sem parecido lista as opções', () => {
    expect(errors(body('a "A"', 'cor: azul'))[0]?.message).toBe('diretiva desconhecida "cor". Use "title" ou "direction"');
  });

  it('diretiva repetida e direção inválida', () => {
    expect(errors(body('a "A"', 'title: um', 'title: dois'))[0]).toEqual({
      line: 4,
      message: '"title" repetido; já declarado na linha 3',
    });
    expect(errors(body('a "A"', 'direction: up'))[0]?.message).toBe('direção "up" inválida. Use auto, right ou down');
  });

  it('limites de tamanho', () => {
    const long = (size: number): string => 'x'.repeat(size);
    expect(errors(body(`a "${long(31)}"`))[0]).toEqual({ line: 2, message: 'rótulo com 31 caracteres; o máximo é 28' });
    expect(errors(body(`a "A" / ${long(25)}`))[0]?.message).toBe('subtítulo com 25 caracteres; o máximo é 24');
    expect(errors(body('a "A"', 'b "B"', `a -> b : ${long(29)}`))[0]?.message).toBe(
      'rótulo com 29 caracteres; o máximo é 28',
    );
    expect(errors(body('a "A"', 'b "B"', `a -> b : x | ${long(13)}`))[0]?.message).toBe(
      'rótulo curto com 13 caracteres; o máximo é 12',
    );
  });

  it('o limite de rótulo aceita exatamente o máximo', () => {
    expect(parseDiagram(body(`a "${'é'.repeat(28)}"`)).ok).toBe(true);
  });

  it('limites de quantidade', () => {
    const nodes = Array.from({ length: 13 }, (_, index) => `n${String(index)} "N"`);
    expect(errors(body(...nodes))).toEqual([{ line: 14, message: 'mais de 12 nós; o máximo é 12' }]);

    const fan = Array.from({ length: 6 }, (_, index) => `n${String(index)} "N"`);
    const pairs = fan.flatMap((_, a) => fan.slice(a + 1).map((__, b) => `n${String(a)} -> n${String(a + b + 1)}`));
    expect(pairs.length).toBeGreaterThan(14);
    const extra = Array.from({ length: 2 }, (_, index) => `m${String(index)} "M"`);
    const more = ['n0 -> m0', 'n0 -> m1'];
    const list = errors(body(...fan, ...extra, ...pairs, ...more));
    expect(list.map((error) => error.message)).toEqual(['mais de 16 arestas; o máximo é 16']);
  });

  it('aresta repetida', () => {
    expect(errors(body('a "A"', 'b "B"', 'a -> b', 'a -> b : de novo'))).toEqual([
      { line: 5, message: 'aresta a -> b repetida; já declarada na linha 4' },
    ]);
  });

  it('nó sem aspas, aspas sem fechar, id inválido, rótulo vazio e aresta incompleta', () => {
    expect(errors(body('a Rótulo'))[0]?.message).toBe('o rótulo do nó "a" precisa estar entre aspas: a "Rótulo"');
    expect(errors(body('a "A', 'b "B"'))[0]).toEqual({ line: 2, message: 'aspas sem fechar' });
    expect(errors(body('Nginx "N"'))[0]?.message).toContain('id "Nginx" inválido');
    expect(errors(body('a ""'))[0]?.message).toBe('o rótulo do nó "a" está vazio');
    expect(errors(body('a "A"', 'a ->'))[0]?.message).toBe('aresta incompleta. Use: de -> para : rótulo | curto');
  });

  it('cabeçalho: vazio, sem id, id inválido, tipo planejado, tipo desconhecido, ausente', () => {
    expect(errors('  \n# nada')[0]?.message).toBe('diagrama vazio. Comece com "flow <id>" ou "spectrum <id>"');
    expect(errors('flow\na "A"')[0]?.message).toBe('falta o id. Use "flow <id>"');
    expect(errors('flow 1x\na "A"')[0]?.message).toContain('id "1x" inválido');
    expect(errors('compare x\na "A"')[0]?.message).toBe('o tipo "compare" ainda não é suportado. Use "flow" ou "spectrum"');
    expect(errors('sequence x\na "A"')[0]?.message).toBe('o tipo "sequence" ainda não é suportado. Use "flow" ou "spectrum"');
    expect(errors('grafo x\na "A"')[0]?.message).toBe('tipo desconhecido "grafo". Use "flow" ou "spectrum"');
    expect(errors('a "A"\nb "B"')[0]).toEqual({ line: 1, message: 'comece com "flow <id>"' });
  });

  it('fluxo sem nós', () => {
    expect(errors('flow f')[0]?.message).toBe('o fluxo não tem nós. Declare ao menos um: id "Rótulo"');
  });

  it('junta todos os erros, em ordem de linha', () => {
    const list = errors(body('a "A"', 'a "B"', 'cor: x', 'a -> z', `b "${'x'.repeat(30)}"`));
    expect(list.map((error) => error.line)).toEqual([3, 4, 5, 6]);
  });
});

describe('diagramErrorMessages', () => {
  it('prefixa a linha, e nada quando é válido', () => {
    expect(diagramErrorMessages(REFERENCE_DIAGRAM)).toEqual([]);
    expect(diagramErrorMessages('flow f\na "A"\na -> b')).toEqual(['linha 3: o nó "b" não foi declarado.']);
  });

  it('recusa fonte acima do teto', () => {
    const [message] = diagramErrorMessages(`flow f\n#${'x'.repeat(DIAGRAM_SOURCE_MAX_LENGTH)}`);
    expect(message).toContain('o máximo é 4000');
  });
});

describe('parseDiagram: ciclos', () => {
  it('aceita volta simples e volta maior', () => {
    expect(valid(body('a "A"', 'b "B"', 'a -> b', 'b -> a')).edges).toHaveLength(2);
    expect(valid(body('a "A"', 'b "B"', 'c "C"', 'a -> b', 'b -> c', 'c -> a : de novo')).edges).toHaveLength(3);
  });

  it('o cenário pode passar pela volta', () => {
    const diagram = valid(body('a "A"', 'b "B"', 'a -> b', 'b -> a', 'state x', 'path a b a'));
    expect(diagram.states[0]?.path).toEqual(['a', 'b', 'a']);
  });
});

describe('parseDiagram: estados', () => {
  const flow = body('a "A"', 'b "B"', 'c "C"', 'a -> b', 'b -> c');
  const withState = (...lines: readonly string[]): string => [flow, ...lines].join('\n');

  it('lê caminho, marcas e painel', () => {
    const diagram = valid(`${REFERENCE_DIAGRAM}${REFERENCE_STATES}`);
    expect(diagram.states.map((state) => state.label)).toEqual(['GET /posts/42', 'GET /css/app.css', '502', '504']);
    expect(diagram.states[2]).toMatchObject({
      title: 'Bad Gateway',
      path: ['navegador', 'nginx'],
      edges: [{ from: 'nginx', to: 'fpm', mark: 'broken' }],
      nodes: [{ id: 'fpm', mark: 'down' }],
    });
    expect(Object.keys(diagram.states[2] ?? {})).not.toContain('seen');
  });

  it('fluxo sem estado continua com a lista vazia', () => {
    expect(valid(flow).states).toEqual([]);
  });

  it.each([
    ['state', 'estado sem nome'],
    ['state "dois nomes" extra', 'estado sem nome'],
    ['state x', 'não marca nada'],
    ['state x\npath a', 'ao menos dois nós'],
    ['state x\npath a c', 'aresta que o fluxo não tem'],
    ['state x\npath a z', 'o nó "z" não foi declarado'],
    ['state x\npath a b\npath b c', '"path" repetido'],
    ['state x\na -> c broken', 'não existe no fluxo'],
    ['state x\na -> b', 'marca "" inválida'],
    ['state x\na -> b brokn', 'Use "broken"'],
    ['state x\na -> b broken\na -> b slow', 'repetido'],
    ['state x\nb dwn', 'Use "down"'],
    ['state x\nz down', 'o nó "z" não foi declarado'],
    ['state x\nb down\nb slow', 'repetido'],
    ['state x\nb down\nd "D"', 'antes do primeiro "state"'],
    ['state x\nb down\ntitel: oi', 'Use "title"'],
    ['state x\nb down\ntext: um\ntext: dois', '"text" repetido'],
    ['state x\nb down\nstate x\nb down', 'estado "x" repetido'],
  ])('%s', (lines, message) => {
    expect(errors(withState(lines)).map((error) => error.message).join('\n')).toContain(message);
  });

  it('o erro aponta a linha do estado', () => {
    expect(errors(withState('state x', '  path a z'))[0]?.line).toBe(8);
  });

  it('limita a quantidade de estados', () => {
    const many = Array.from({ length: DIAGRAM_LIMITS.states + 1 }, (_, index) => `state s${String(index)}\nb down`);
    expect(errors(withState(...many))[0]?.message).toContain('estados; o máximo é 6');
  });

  it('limita o tamanho dos campos do painel', () => {
    expect(errors(withState('state x', 'b down', `hint: ${'h'.repeat(DIAGRAM_LIMITS.stateHint + 1)}`))[0]?.message).toContain(
      '"hint" com 121 caracteres',
    );
  });
});

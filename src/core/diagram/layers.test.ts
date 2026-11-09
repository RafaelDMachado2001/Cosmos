import { describe, expect, it } from 'vitest';

import { REFERENCE_LAYERS, REFERENCE_LAYERS_EN } from './fixture';
import { diagramErrorMessages, parseDiagram } from './parse';
import { LAYERS_LIMITS, splitItems } from './parseLayers';
import type { DiagramError, LayerChild, LayerNode, LayersDiagram } from './types';

function valid(source: string): LayersDiagram {
  const result = parseDiagram(source);
  if (!result.ok || result.diagram.kind !== 'layers') throw new Error(JSON.stringify(result));
  return result.diagram;
}

function errors(source: string): readonly DiagramError[] {
  const result = parseDiagram(source);
  if (result.ok) throw new Error('esperava erro');
  return result.errors;
}

const src = (...lines: readonly string[]): string => ['layers l', ...lines].join('\n');

function child(node: LayerNode, index: number): LayerChild {
  const found = node.children[index];
  if (found === undefined) throw new Error(`sem filho ${String(index)}`);
  return found;
}

function layer(node: LayerNode, index: number): LayerNode {
  const found = child(node, index);
  if (found.kind !== 'layer') throw new Error(`filho ${String(index)} não é camada`);
  return found;
}

describe('parseDiagram layers: exemplo de referência', () => {
  const diagram = valid(REFERENCE_LAYERS);

  it('lê tipo, id e título', () => {
    expect(diagram).toMatchObject({ kind: 'layers', id: 'ecossistema-laravel', title: 'O ecossistema Laravel' });
  });

  it('monta a pilha de quatro níveis', () => {
    const { root } = diagram;
    expect(root).toMatchObject({ id: 'infra', name: 'Infraestrutura', note: 'onde a aplicação mora', depth: 1, line: 4 });
    expect(child(root, 0)).toEqual({ kind: 'items', items: ['Forge', 'Vapor', 'Cloud', 'Nightwatch'], line: 5 });
    const runtime = layer(root, 1);
    expect(runtime).toMatchObject({ id: 'runtime', name: 'Servidor / Runtime', depth: 2 });
    const app = layer(runtime, 1);
    expect(app).toMatchObject({ id: 'app', depth: 3, highlight: false });
    expect(layer(app, 1)).toMatchObject({ id: 'core', name: 'laravel/framework', note: 'o núcleo', depth: 4 });
  });

  it('preserva a ordem declarada em "Aplicação": grupo, camada, grupo, grupo', () => {
    const app = layer(layer(diagram.root, 1), 1);
    expect(app.children.map((item) => (item.kind === 'layer' ? item.id : item.kind === 'group' ? item.name : 'items'))).toEqual([
      'Frontend',
      'core',
      'Pacotes',
      'O seu código',
    ]);
  });

  it('continua a lista pela vírgula: itens de camada, grupo e linha seguinte', () => {
    const app = layer(layer(diagram.root, 1), 1);
    expect(child(layer(app, 1), 0)).toEqual({
      kind: 'items',
      items: ['Container', 'Providers', 'Routing', 'Middleware', 'Validation', 'Eloquent', 'Queues', 'Events', 'Cache'],
      line: 11,
    });
    expect(child(app, 2)).toEqual({
      kind: 'group',
      name: 'Pacotes',
      highlight: false,
      items: ['Sanctum', 'Horizon', 'Reverb', 'Scout', 'Cashier', 'Pennant', 'Pulse', 'Telescope', 'AI SDK', 'MCP'],
      line: 13,
    });
    expect(diagram.asides[0]).toEqual({
      name: 'Desenvolvimento',
      note: 'não vai para produção',
      items: ['Herd', 'Sail', 'Pint', 'Pest', 'Dusk', 'Boost'],
      line: 18,
    });
  });

  it('vírgula entre parênteses não separa', () => {
    const app = layer(layer(diagram.root, 1), 1);
    expect(child(app, 0)).toMatchObject({ name: 'Frontend', items: ['Blade', 'Livewire', 'Inertia (React/Vue)', 'Vite'] });
    expect(splitItems(' a (b, c) , d ')).toEqual(['a (b, c)', 'd']);
  });

  it('grupo com highlight, base e aside', () => {
    const app = layer(layer(diagram.root, 1), 1);
    expect(child(app, 3)).toMatchObject({ kind: 'group', name: 'O seu código', highlight: true });
    expect(diagram.base).toEqual({
      name: 'A base de tudo',
      note: null,
      items: ['PHP 8.3+', 'Composer', 'PSRs', 'componentes do Symfony'],
      line: 17,
    });
    expect(diagram.asides).toHaveLength(1);
  });

  it('a versão em inglês tem a mesma forma', () => {
    const english = valid(REFERENCE_LAYERS_EN);
    expect(english.root.depth).toBe(1);
    expect(english.asides).toHaveLength(1);
    expect(english.base?.items).toContain('Symfony components');
  });

  it('highlight depois da nota marca a camada', () => {
    const diagram = valid(src('a "A" / nota highlight', '  : x'));
    expect(diagram.root).toMatchObject({ note: 'nota', highlight: true });
    expect(valid(src('a "A" highlight', '  : x')).root).toMatchObject({ note: null, highlight: true });
  });

  it('itens do base e do aside podem vir na linha seguinte', () => {
    const diagram = valid(src('a "A"', '  : x', 'base "B" / nota', '  : y, z'));
    expect(diagram.base).toMatchObject({ note: 'nota', items: ['y', 'z'] });
  });
});

describe('parseDiagram layers: erros', () => {
  it('indentação fora do passo', () => {
    expect(errors(src('a "A"', '   : x'))).toContainEqual({ line: 3, message: 'indentação de 3 espaços; use múltiplos de 2' });
  });

  it('tab é erro', () => {
    expect(errors(src('a "A"', '\t: x'))).toContainEqual({ line: 3, message: 'tab na indentação; use 2 espaços por nível' });
  });

  it('nível pulado', () => {
    expect(errors(src('infra "I"', '  runtime "R"', '      core "C"', '        : x'))).toContainEqual({
      line: 4,
      message: '"core" está dois níveis abaixo de "runtime"; falta uma camada no meio?',
    });
  });

  it('itens sem camada', () => {
    expect(errors(src('a "A"', '  : x', ': y'))).toContainEqual({
      line: 4,
      message: 'itens sem camada; a linha ": ..." precisa ficar logo abaixo de uma camada',
    });
  });

  it('grupo com camada dentro', () => {
    expect(errors(src('a "A"', '  group "G": x', '    b "B"'))).toContainEqual({
      line: 4,
      message: 'um grupo não pode ter camadas dentro',
    });
  });

  it('base indentado e base repetido', () => {
    expect(errors(src('a "A"', '  : x', '  base "B": y'))).toContainEqual({
      line: 4,
      message: '"base" só pode aparecer fora da pilha (sem indentação)',
    });
    expect(errors(src('a "A"', '  : x', 'base "B": y', 'base "C": z'))).toContainEqual({
      line: 5,
      message: 'só pode existir um "base"',
    });
  });

  it('no máximo dois aside', () => {
    const list = errors(src('a "A"', '  : x', 'aside "B": y', 'aside "C": z', 'aside "D": w'));
    expect(list).toContainEqual({ line: 6, message: 'só podem existir 2 "aside"' });
  });

  it('camada vazia', () => {
    expect(errors(src('infra "I"'))).toEqual([{ line: 2, message: 'a camada "infra" está vazia' }]);
  });

  it('palavra desconhecida com sugestão', () => {
    expect(errors(src('a "A"', '  grup "G": x'))).toContainEqual({
      line: 3,
      message: 'palavra desconhecida "grup". Você quis dizer "group"?',
    });
  });

  it('id repetido, no formato do flow', () => {
    expect(errors(src('a "A"', '  a "B"', '    : x'))).toContainEqual({
      line: 3,
      message: 'id "a" repetido; já declarado na linha 2',
    });
  });

  it('direction não se aplica', () => {
    expect(errors(src('direction: down', 'a "A"', '  : x'))).toContainEqual({
      line: 2,
      message: '"direction" não se aplica a layers',
    });
  });

  it('tipo parecido sugere "layers" e lê o corpo como camadas', () => {
    expect(errors('layer l\na "A"\n  : x')).toEqual([{ line: 1, message: 'tipo desconhecido "layer". Você quis dizer "layers"?' }]);
  });

  it('lista que termina em vírgula sem continuação', () => {
    expect(errors(src('a "A"', '  : x, y,', '  b "B"', '    : z'))).toContainEqual({
      line: 3,
      message: 'a lista termina em vírgula, mas a linha seguinte não continua',
    });
  });

  it('limites de item, nome, nota, profundidade e total', () => {
    const longItem = 'x'.repeat(LAYERS_LIMITS.item + 1);
    expect(errors(src('a "A"', `  : ${longItem}`))[0]?.message).toBe(`item "${longItem}" com 33 caracteres; o máximo é 32`);
    expect(errors(src(`a "${'n'.repeat(29)}"`, '  : x'))[0]?.message).toBe('nome com 29 caracteres; o máximo é 28');
    expect(errors(src(`a "A" / ${'n'.repeat(49)}`, '  : x'))[0]?.message).toBe('nota com 49 caracteres; o máximo é 48');

    const deep = ['a', 'b', 'c', 'd', 'e', 'f'].map((id, index) => `${'  '.repeat(index)}${id} "${id}"`);
    expect(errors(src(...deep, `${'  '.repeat(6)}: x`))).toContainEqual({
      line: 7,
      message: '"f" fica na profundidade 6; o máximo é 5',
    });

    const many = Array.from({ length: LAYERS_LIMITS.items + 1 }, (_, index) => `i${String(index)}`).join(', ');
    expect(errors(src('a "A"', `  : ${many}`))).toEqual([{ line: 3, message: 'mais de 60 itens; o máximo é 60' }]);
  });

  it('junta vários erros num passe, em ordem de linha', () => {
    const list = errors(src('a "A"', '   : x', '  grup "G": y', '  b "B"', '  base "C": z'));
    expect(list.map((error) => error.line)).toEqual([3, 4, 5, 6]);
  });

  it('as mensagens saem com o número da linha', () => {
    expect(diagramErrorMessages(src('infra "I"'))).toEqual(['linha 2: a camada "infra" está vazia']);
  });
});

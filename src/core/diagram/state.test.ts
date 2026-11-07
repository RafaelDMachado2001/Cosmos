import { describe, expect, it } from 'vitest';

import { REFERENCE_DIAGRAM, REFERENCE_STATES } from './fixture';
import { layoutDiagram } from './layout';
import { parseDiagram } from './parse';
import { diagramStateLayer, diagramStateTone } from './state';

function reference() {
  const result = parseDiagram(`${REFERENCE_DIAGRAM}${REFERENCE_STATES}`);
  if (!result.ok) throw new Error('fixture inválida');
  return { diagram: result.diagram, layout: layoutDiagram(result.diagram, 'right') };
}

describe('diagramStateLayer', () => {
  it('o tom sai da marca mais grave', () => {
    const { diagram } = reference();
    expect(diagram.states.map(diagramStateTone)).toEqual(['neutral', 'neutral', 'err', 'warn']);
  });

  it('a rota segue o caminho e termina na aresta marcada', () => {
    const { diagram, layout } = reference();
    const state = diagram.states[3];
    if (state === undefined) throw new Error('fixture sem 504');
    const layer = diagramStateLayer(state, layout);
    expect(layer.edges.map(({ edge, tone }) => [edge.from, edge.to, tone])).toEqual([
      ['navegador', 'nginx', 'active'],
      ['nginx', 'fpm', 'active'],
      ['fpm', 'php', 'slow'],
    ]);
    expect(layer.route).toBe(layer.edges.map(({ edge }) => edge.d).join(' '));
  });

  it('a marca vence o caminho, nas arestas e nos nós', () => {
    const { diagram, layout } = reference();
    const state = diagram.states[2];
    if (state === undefined) throw new Error('fixture sem 502');
    const overlapping = { ...state, path: ['navegador', 'nginx', 'fpm'] };
    const layer = diagramStateLayer(overlapping, layout);
    expect(layer.edges.map(({ tone }) => tone)).toEqual(['active', 'broken']);
    expect(layer.nodes.map(({ node, tone }) => [node.id, tone])).toEqual([
      ['navegador', 'active'],
      ['nginx', 'active'],
      ['fpm', 'down'],
    ]);
  });

  it('só nó marcado não tem rota', () => {
    const { diagram, layout } = reference();
    const state = diagram.states[2];
    if (state === undefined) throw new Error('fixture sem 502');
    expect(diagramStateLayer({ ...state, path: [], edges: [] }, layout).route).toBeNull();
  });
});

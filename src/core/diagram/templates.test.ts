import { describe, expect, it } from 'vitest';

import { parseDiagram } from './parse';
import { DIAGRAM_SYNTAX_EXAMPLE, DIAGRAM_TEMPLATES } from './templates';

describe('modelos do diagrama', () => {
  it.each(DIAGRAM_TEMPLATES.map((template) => [template.label, template.source]))('%s é válido', (_label, source) => {
    expect(parseDiagram(source)).toMatchObject({ ok: true });
  });

  it('cada modelo mostra um formato de ligação', () => {
    const fanning = DIAGRAM_TEMPLATES.map(({ source }) => {
      const result = parseDiagram(source);
      if (!result.ok) throw new Error('modelo inválido');
      const { edges } = result.diagram;
      const widest = (ends: readonly string[]): number =>
        Math.max(...ends.map((end) => ends.filter((other) => other === end).length));
      return [widest(edges.map((edge) => edge.from)), widest(edges.map((edge) => edge.to))];
    });
    expect(fanning).toEqual([
      [1, 1],
      [2, 1],
      [1, 2],
    ]);
  });

  it('o exemplo da ajuda cobre o que ensina e é válido', () => {
    const result = parseDiagram(DIAGRAM_SYNTAX_EXAMPLE);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(result.diagram.states[0]).toMatchObject({
      label: '502',
      hint: 'Por onde começar.',
      path: ['a', 'b'],
      edges: [{ from: 'b', to: 'c', mark: 'broken' }],
      nodes: [{ id: 'c', mark: 'down' }],
    });
  });
});

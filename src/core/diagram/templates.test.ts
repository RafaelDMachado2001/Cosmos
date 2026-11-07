import { describe, expect, it } from 'vitest';

import { parseDiagram } from './parse';
import {
  DIAGRAM_SYNTAX_EXAMPLE,
  DIAGRAM_TEMPLATES,
  SEQUENCE_SYNTAX_EXAMPLE,
  SPECTRUM_SYNTAX_EXAMPLE,
} from './templates';

describe('modelos do diagrama', () => {
  it.each(DIAGRAM_TEMPLATES.map((template) => [template.label, template.source]))('%s é válido', (_label, source) => {
    expect(parseDiagram(source)).toMatchObject({ ok: true });
  });

  it('cada modelo mostra um formato de ligação', () => {
    const flows = DIAGRAM_TEMPLATES.filter(({ source }) => source.startsWith('flow'));
    const fanning = flows.map(({ source }) => {
      const result = parseDiagram(source);
      if (!result.ok || result.diagram.kind !== 'flow') throw new Error('modelo inválido');
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
    if (!result.ok || result.diagram.kind !== 'flow') throw new Error('exemplo inválido');
    expect(result.diagram.states[0]).toMatchObject({
      label: '502',
      hint: 'Por onde começar.',
      path: ['a', 'b'],
      edges: [{ from: 'b', to: 'c', mark: 'broken' }],
      nodes: [{ id: 'c', mark: 'down' }],
    });
  });

  it('o exemplo do espectro é válido', () => {
    expect(parseDiagram(SPECTRUM_SYNTAX_EXAMPLE)).toMatchObject({ ok: true, diagram: { kind: 'spectrum' } });
  });

  it('o exemplo da sequência é válido', () => {
    expect(parseDiagram(SEQUENCE_SYNTAX_EXAMPLE)).toMatchObject({ ok: true, diagram: { kind: 'sequence' } });
  });
});

import { describe, expect, it } from 'vitest';

import { REFERENCE_DIAGRAM } from './fixture';
import { DIAGRAM_MAX_WIDTH, diagramLayouts, layoutDiagram } from './layout';
import { LABEL_HEIGHT } from './measure';
import { parseDiagram } from './parse';
import type { DiagramLayout, DiagramOrientation, FlowDiagram } from './types';

function diagram(source: string): FlowDiagram {
  const result = parseDiagram(source);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.diagram;
}

interface Box {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

function box(x: number, y: number, w: number, h: number): Box {
  return { left: x - w / 2, right: x + w / 2, top: y - h / 2, bottom: y + h / 2 };
}

function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

function pointsOf(layout: DiagramLayout): readonly (readonly [number, number])[] {
  return layout.edges.flatMap((edge) =>
    [...edge.d.matchAll(/(-?[0-9.]+),(-?[0-9.]+)/g), ...edge.arrow.matchAll(/(-?[0-9.]+),(-?[0-9.]+)/g)].map(
      (match) => [Number(match[1]), Number(match[2])] as const,
    ),
  );
}

function wireSegments(layout: DiagramLayout): readonly { readonly edge: string; readonly a: readonly [number, number]; readonly b: readonly [number, number] }[] {
  return layout.edges.flatMap((edge) => {
    const points = [...edge.d.matchAll(/(-?[0-9.]+),(-?[0-9.]+)/g)].map(
      (match) => [Number(match[1]), Number(match[2])] as const,
    );
    return points.slice(1).map((b, index) => ({ edge: `${edge.from}-${edge.to}`, a: points[index] as readonly [number, number], b }));
  });
}

const node = (id: string): string => `${id} "${id.toUpperCase()}" / sub ${id}`;
const flow = (...lines: readonly string[]): string => ['flow f', ...lines].join('\n');

const LONG = 'rótulo bem comprido demais';

const GRAPHS: Readonly<Record<string, string>> = {
  'volta simples': flow(...['a', 'b'].map(node), 'a -> b : pede', 'b -> a : responde | volta'),
  'volta com saída': flow(...['a', 'b', 'c'].map(node), 'a -> b', 'b -> c : ok', 'b -> a : tenta de novo | de novo'),
  'volta longa sobre ramos': flow(
    ...['a', 'b', 'c', 'd', 'e'].map(node),
    'a -> b : um',
    'a -> c : dois',
    'b -> d',
    'c -> d',
    'd -> e',
    `e -> a : ${LONG}`,
  ),
  'três voltas': flow(
    ...['a', 'b', 'c', 'd'].map(node),
    'a -> b',
    'b -> c',
    'c -> d',
    `b -> a : ${LONG}`,
    `c -> a : ${LONG}`,
    `d -> b : ${LONG}`,
  ),
  linear: flow(...['a', 'b', 'c', 'd'].map(node), `a -> b : ${LONG}`, 'b -> c : x', 'c -> d'),
  ramificado: flow(...['a', 'b', 'c', 'd', 'e'].map(node), 'a -> b : um', 'a -> c : dois', 'a -> d : três', 'c -> e : fim'),
  convergencia: flow(...['a', 'b', 'c', 'd'].map(node), 'a -> d : um', 'b -> d : dois', 'c -> d : três'),
  'cheio entre camadas': flow(
    ...['a', 'b', 'c', 'd'].map(node),
    `a -> c : ${LONG}`,
    `a -> d : ${LONG}`,
    `b -> c : ${LONG}`,
    `b -> d : ${LONG}`,
  ),
  'pula camada': flow(...['a', 'b', 'c', 'd'].map(node), 'a -> b', 'b -> c', 'c -> d', `a -> d : ${LONG}`, 'a -> c : atalho'),
  'nó isolado': flow(...['a', 'b', 'x'].map(node), 'a -> b : liga'),
  '12 nós': flow(
    ...Array.from({ length: 12 }, (_, index) => node(`n${String(index)}`)),
    ...Array.from({ length: 11 }, (_, index) => `n${String(Math.floor(index / 2))} -> n${String(index + 1)} : passo ${String(index)}`),
  ),
  referência: REFERENCE_DIAGRAM,
};

const ORIENTATIONS: readonly DiagramOrientation[] = ['right', 'down'];

describe('layoutDiagram: propriedades', () => {
  for (const [name, source] of Object.entries(GRAPHS)) {
    for (const orientation of ORIENTATIONS) {
      describe(`${name} (${orientation})`, () => {
        const layout = layoutDiagram(diagram(source), orientation);
        const nodes = layout.nodes.map((entry) => box(entry.x, entry.y, entry.w, entry.h));
        const labels = layout.edges.flatMap((edge) =>
          edge.label === null ? [] : [box(edge.label.x, edge.label.y, edge.label.w, LABEL_HEIGHT)],
        );

        it('nenhum nó sobre outro', () => {
          nodes.forEach((a, i) => nodes.slice(i + 1).forEach((b) => expect(overlaps(a, b)).toBe(false)));
        });

        it('nenhum rótulo sobre nó', () => {
          for (const label of labels) for (const entry of nodes) expect(overlaps(label, entry)).toBe(false);
        });

        it('nenhum rótulo sobre outro', () => {
          labels.forEach((a, i) => labels.slice(i + 1).forEach((b) => expect(overlaps(a, b)).toBe(false)));
        });

        it('nenhuma aresta atravessa um nó que não é o dela', () => {
          for (const segment of wireSegments(layout)) {
            layout.nodes.forEach((entry) => {
              const [from, to] = segment.edge.split('-');
              if (entry.id === from || entry.id === to) return;
              const area = box(entry.x, entry.y, entry.w, entry.h);
              const wire = {
                left: Math.min(segment.a[0], segment.b[0]),
                right: Math.max(segment.a[0], segment.b[0]),
                top: Math.min(segment.a[1], segment.b[1]),
                bottom: Math.max(segment.a[1], segment.b[1]),
              };
              expect(wire.left <= area.right && area.left <= wire.right && wire.top <= area.bottom && area.top <= wire.bottom).toBe(false);
            });
          }
        });

        it('tudo cabe no viewBox', () => {
          for (const entry of [...nodes, ...labels]) {
            expect(entry.left).toBeGreaterThanOrEqual(0);
            expect(entry.top).toBeGreaterThanOrEqual(0);
            expect(entry.right).toBeLessThanOrEqual(layout.width);
            expect(entry.bottom).toBeLessThanOrEqual(layout.height);
          }
          for (const [x, y] of pointsOf(layout)) {
            expect(x).toBeGreaterThanOrEqual(0);
            expect(x).toBeLessThanOrEqual(layout.width);
            expect(y).toBeGreaterThanOrEqual(0);
            expect(y).toBeLessThanOrEqual(layout.height);
          }
        });

        it('todo número tem no máximo uma casa decimal', () => {
          const text = JSON.stringify(layout);
          expect(text).not.toMatch(/\d\.\d{2}/);
        });
      });
    }
  }
});

describe('layoutDiagram: exemplo de referência', () => {
  const reference = diagram(REFERENCE_DIAGRAM);

  it('horizontal', () => {
    expect(layoutDiagram(reference, 'right')).toMatchSnapshot();
  });

  it('vertical, com os rótulos curtos', () => {
    const layout = layoutDiagram(reference, 'down');
    expect(layout).toMatchSnapshot();
    expect(layout.edges.map((edge) => edge.label?.text)).toEqual(['HTTPS', 'existe?', 'FastCGI', 'executa']);
  });

  it('é determinístico', () => {
    expect(layoutDiagram(reference, 'right')).toEqual(layoutDiagram(reference, 'right'));
  });
});

describe('layoutDiagram: regras', () => {
  it('camadas pelo caminho mais longo, nó isolado no rank 0', () => {
    const layout = layoutDiagram(diagram(flow(...['a', 'b', 'c', 'x'].map(node), 'a -> b', 'b -> c', 'a -> c')), 'right');
    const x = (id: string): number => layout.nodes.find((entry) => entry.id === id)?.x ?? 0;
    expect(x('a')).toBeLessThan(x('b'));
    expect(x('b')).toBeLessThan(x('c'));
    expect(x('x')).toBe(x('a'));
  });

  it('nós na mesma altura ligam por reta, com setas na direção do segmento', () => {
    const right = layoutDiagram(diagram(flow('a "A"', 'b "B"', 'a -> b')), 'right').edges[0];
    expect(right?.d).toMatch(/^M[0-9.,]+ L[0-9.,]+$/);
    const down = layoutDiagram(diagram(flow('a "A"', 'b "B"', 'a -> b')), 'down').edges[0];
    expect(down?.d).toMatch(/^M[0-9.,]+ L[0-9.,]+$/);
    const tip = down?.arrow.split(' ')[0];
    expect(down?.d.endsWith(tip ?? '')).toBe(true);
  });

  it('vão mínimo sem rótulo', () => {
    const layout = layoutDiagram(diagram(flow('a "A"', 'b "B"', 'a -> b')), 'right');
    const [a, b] = layout.nodes;
    expect((b?.x ?? 0) - (b?.w ?? 0) / 2 - ((a?.x ?? 0) + (a?.w ?? 0) / 2)).toBeCloseTo(72, 1);
  });

  it('vão cresce para caber o rótulo mais a folga', () => {
    const layout = layoutDiagram(diagram(flow('a "A"', 'b "B"', `a -> b : ${LONG}`)), 'right');
    const [a, b] = layout.nodes;
    const width = layout.edges[0]?.label?.w ?? 0;
    expect((b?.x ?? 0) - (b?.w ?? 0) / 2 - ((a?.x ?? 0) + (a?.w ?? 0) / 2)).toBeCloseTo(width + 24, 0);
  });

  it('cotovelo sem ramificação nem rótulo fica no meio do vão', () => {
    const layout = layoutDiagram(
      diagram(flow('a "A"', 'b "B"', 'c "C"', 'd "D"', 'e "E"', 'a -> c', 'b -> d', 'd -> e')),
      'right',
    );
    expect(layout.edges.every((edge) => edge.d.includes('L'))).toBe(true);
  });

  it('largura e altura descontam a margem de 16', () => {
    const layout = layoutDiagram(diagram(flow('a "A"')), 'right');
    expect(layout.nodes[0]).toMatchObject({ x: 16 + (layout.nodes[0]?.w ?? 0) / 2, y: 32 });
    expect(layout.height).toBe(64);
  });
});

describe('layoutDiagram: ciclos', () => {
  const BACK = flow(...['a', 'b', 'c'].map(node), 'a -> b', 'b -> c', 'c -> a : de novo');

  it('a volta não muda as camadas do resto', () => {
    const without = layoutDiagram(diagram(flow(...['a', 'b', 'c'].map(node), 'a -> b', 'b -> c')), 'right');
    const looped = layoutDiagram(diagram(BACK), 'right');
    const order = (layout: DiagramLayout): readonly string[] =>
      [...layout.nodes].sort((x, y) => x.x - y.x).map((box) => box.id);
    expect(order(looped)).toEqual(order(without));
  });

  it('a volta corre por fora de todos os nós, com o rótulo na pista', () => {
    const layout = layoutDiagram(diagram(BACK), 'right');
    const back = layout.edges.find((edge) => edge.from === 'c');
    const bottom = Math.max(...layout.nodes.map((box) => box.y + box.h / 2));
    expect(back?.label?.y).toBeGreaterThan(bottom);
  });

  it('a seta da volta entra pelo lado de entrada do destino', () => {
    const layout = layoutDiagram(diagram(BACK), 'right');
    const target = layout.nodes.find((box) => box.id === 'a');
    expect(layout.edges.find((edge) => edge.from === 'c')?.tip.x).toBe((target?.x ?? 0) - (target?.w ?? 0) / 2);
  });

  it('no celular a pista corre à direita', () => {
    const layout = layoutDiagram(diagram(BACK), 'down');
    const right = Math.max(...layout.nodes.map((box) => box.x + box.w / 2));
    expect(layout.edges.find((edge) => edge.from === 'c')?.label?.x).toBeGreaterThan(right);
  });

  it('a seta da volta não encosta na do caminho de ida', () => {
    const layout = layoutDiagram(diagram(flow(...['a', 'b'].map(node), 'a -> b', 'b -> a')), 'right');
    const [ida, volta] = layout.edges;
    expect(ida?.tip.y).not.toBe(volta?.tip.y);
  });
});

describe('diagramLayouts', () => {
  it('auto entrega as duas orientações', () => {
    expect(diagramLayouts(diagram(REFERENCE_DIAGRAM)).map((layout) => layout.orientation)).toEqual(['right', 'down']);
  });

  it('direção fixa entrega uma só', () => {
    expect(diagramLayouts(diagram(flow('direction: right', 'a "A"'))).map((l) => l.orientation)).toEqual(['right']);
    expect(diagramLayouts(diagram(flow('direction: down', 'a "A"'))).map((l) => l.orientation)).toEqual(['down']);
  });

  it(`auto larga demais para a coluna de ${String(DIAGRAM_MAX_WIDTH)}px fica só com a vertical`, () => {
    const count = 12;
    const nodes = Array.from({ length: count }, (_, index) => `n${String(index)} "${'x'.repeat(28)}"`);
    const edges = Array.from({ length: count - 1 }, (_, index) => `n${String(index)} -> n${String(index + 1)}`);
    expect(diagramLayouts(diagram(flow(...nodes, ...edges))).map((l) => l.orientation)).toEqual(['down']);
  });
});

import type {
  DiagramLayout,
  DiagramLayoutEdge,
  DiagramLayoutNode,
  DiagramState,
  DiagramStateTone,
} from './types';

export type DiagramEdgeTone = 'active' | 'broken' | 'slow';

export type DiagramNodeTone = 'active' | 'down' | 'slow';

export interface DiagramLayerEdge {
  readonly edge: DiagramLayoutEdge;
  readonly tone: DiagramEdgeTone;
}

export interface DiagramLayerNode {
  readonly node: DiagramLayoutNode;
  readonly tone: DiagramNodeTone;
}

export interface DiagramStateLayer {
  readonly edges: readonly DiagramLayerEdge[];
  readonly nodes: readonly DiagramLayerNode[];
  readonly route: string | null;
  readonly tone: DiagramStateTone;
}

export function diagramStateTone(state: DiagramState): DiagramStateTone {
  const marks = [...state.edges, ...state.nodes].map((target) => target.mark);
  if (marks.some((mark) => mark === 'broken' || mark === 'down')) return 'err';
  return marks.includes('slow') ? 'warn' : 'neutral';
}

export function diagramStateLayer(state: DiagramState, layout: DiagramLayout): DiagramStateLayer {
  const pathEdges = state.path.slice(1).map((to, index) => ({ from: state.path[index] ?? '', to }));
  const ends = [...pathEdges, ...state.edges].map(({ from, to }) => `${from} -> ${to}`);
  const route = [...new Set(ends)];

  const edges = route.flatMap((key): DiagramLayerEdge[] => {
    const edge = layout.edges.find((candidate) => `${candidate.from} -> ${candidate.to}` === key);
    if (edge === undefined) return [];
    const mark = state.edges.find((target) => target.from === edge.from && target.to === edge.to)?.mark;
    return [{ edge, tone: mark ?? 'active' }];
  });

  const nodeIds = [...new Set([...state.path, ...state.nodes.map((node) => node.id)])];
  const nodes = nodeIds.flatMap((id): DiagramLayerNode[] => {
    const node = layout.nodes.find((candidate) => candidate.id === id);
    if (node === undefined) return [];
    return [{ node, tone: state.nodes.find((target) => target.id === id)?.mark ?? 'active' }];
  });

  return {
    edges,
    nodes,
    route: edges.length === 0 ? null : edges.map(({ edge }) => edge.d).join(' '),
    tone: diagramStateTone(state),
  };
}

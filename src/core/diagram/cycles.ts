interface Link {
  readonly from: string;
  readonly to: string;
}

export interface ReturnEdge<T> {
  readonly edge: T;
  readonly path: readonly string[];
}

export function findReturnEdges<T extends Link>(
  nodeIds: readonly string[],
  edges: readonly T[],
): readonly ReturnEdge<T>[] {
  const outgoing = new Map<string, T[]>();
  for (const edge of edges) outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge]);

  const finished = new Set<string>();
  const trail: string[] = [];
  const found: ReturnEdge<T>[] = [];

  const visit = (id: string): void => {
    trail.push(id);
    for (const edge of outgoing.get(id) ?? []) {
      const start = trail.indexOf(edge.to);
      if (start !== -1) found.push({ edge, path: [...trail.slice(start), edge.to] });
      else if (!finished.has(edge.to)) visit(edge.to);
    }
    trail.pop();
    finished.add(id);
  };

  for (const id of nodeIds) {
    if (!finished.has(id)) visit(id);
  }
  return found;
}

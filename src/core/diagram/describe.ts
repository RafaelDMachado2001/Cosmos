import type { FlowDiagram } from './types';

export interface DiagramVocabulary {
  readonly to: string;
  readonly via: string;
  readonly when: string;
  readonly isolated: string;
}

export const DIAGRAM_VOCABULARY_PT: DiagramVocabulary = {
  to: 'para',
  via: 'via',
  when: 'quando',
  isolated: 'sem conexões',
};

export function describeDiagram(diagram: FlowDiagram, vocabulary: DiagramVocabulary = DIAGRAM_VOCABULARY_PT): string {
  const labels = new Map(diagram.nodes.map((node) => [node.id, node.label]));
  const connected = new Set(diagram.edges.flatMap((edge) => [edge.from, edge.to]));

  const sentences = diagram.edges.map((edge) => {
    const path = `${labels.get(edge.from) ?? edge.from} ${vocabulary.to} ${labels.get(edge.to) ?? edge.to}`;
    if (edge.label === null) return path;
    const connector = edge.label.endsWith('?') ? vocabulary.when : vocabulary.via;
    return `${path}, ${connector} ${edge.label}`;
  });

  const isolated = diagram.nodes
    .filter((node) => !connected.has(node.id))
    .map((node) => `${node.label}, ${vocabulary.isolated}`);

  return [...sentences, ...isolated].map((sentence) => `${sentence}${sentence.endsWith('?') ? '' : '.'}`).join(' ');
}

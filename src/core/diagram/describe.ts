import type { DiagramState, FlowDiagram, SpectrumDiagram } from './types';

export interface DiagramVocabulary {
  readonly to: string;
  readonly when: string;
  readonly isolated: string;
  readonly scenario: string;
  readonly route: string;
  readonly hint: string;
  readonly broken: string;
  readonly slow: string;
  readonly down: string;
  readonly rangeFrom: string;
  readonly rangeTo: string;
}

export const DIAGRAM_VOCABULARY_PT: DiagramVocabulary = {
  to: 'para',
  when: 'quando',
  isolated: 'sem conexões',
  scenario: 'Cenário',
  route: 'Caminho',
  hint: 'Dica',
  broken: 'com falha',
  slow: 'lento',
  down: 'fora do ar',
  rangeFrom: 'de',
  rangeTo: 'a',
};

function sentence(text: string): string {
  return /[.?!]$/.test(text) ? text : `${text}.`;
}

function describeState(diagram: FlowDiagram, state: DiagramState, vocabulary: DiagramVocabulary): string {
  const labels = new Map(diagram.nodes.map((node) => [node.id, node.label]));
  const name = (id: string): string => labels.get(id) ?? id;
  const heading = `${vocabulary.scenario} ${state.label}${state.title === null ? '' : `: ${state.title}`}`;
  return [
    heading,
    state.text,
    state.path.length === 0 ? null : `${vocabulary.route}: ${state.path.map(name).join(', ')}`,
    ...state.edges.map((edge) => `${name(edge.from)} ${vocabulary.to} ${name(edge.to)} ${vocabulary[edge.mark]}`),
    ...state.nodes.map((node) => `${name(node.id)} ${vocabulary[node.mark]}`),
    state.hint === null ? null : `${vocabulary.hint}: ${state.hint}`,
  ]
    .filter((text) => text !== null)
    .map(sentence)
    .join(' ');
}

export function describeDiagram(diagram: FlowDiagram, vocabulary: DiagramVocabulary = DIAGRAM_VOCABULARY_PT): string {
  const labels = new Map(diagram.nodes.map((node) => [node.id, node.label]));
  const connected = new Set(diagram.edges.flatMap((edge) => [edge.from, edge.to]));

  const sentences = diagram.edges.map((edge) => {
    const path = `${labels.get(edge.from) ?? edge.from} ${vocabulary.to} ${labels.get(edge.to) ?? edge.to}`;
    if (edge.label === null) return path;
    return edge.label.endsWith('?') ? `${path}, ${vocabulary.when} ${edge.label}` : `${path}: ${edge.label}`;
  });

  const isolated = diagram.nodes
    .filter((node) => !connected.has(node.id))
    .map((node) => `${node.label}, ${vocabulary.isolated}`);

  const flow = [...sentences, ...isolated].map(sentence);
  const states = diagram.states.map((state) => describeState(diagram, state, vocabulary));
  return [...flow, ...states].join(' ');
}

export function describeSpectrum(diagram: SpectrumDiagram, vocabulary: DiagramVocabulary = DIAGRAM_VOCABULARY_PT): string {
  const range = (from: number, to: number): string =>
    `${vocabulary.rangeFrom} ${String(from)}% ${vocabulary.rangeTo} ${String(to)}%`;
  return [
    diagram.axis === null ? null : `${diagram.axis.from} ${vocabulary.to} ${diagram.axis.to}`,
    ...diagram.zones.map((zone) =>
      [`${zone.label}, ${range(zone.from, zone.to)}`, zone.taste, zone.next].filter((text) => text !== null).join(': '),
    ),
    ...diagram.lanes.map((lane) => `${lane.label}, ${range(lane.from, lane.to)}`),
  ]
    .filter((text) => text !== null)
    .map(sentence)
    .join(' ');
}

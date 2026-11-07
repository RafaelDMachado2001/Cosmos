export type DiagramDirection = 'auto' | 'right' | 'down';

export type DiagramOrientation = Exclude<DiagramDirection, 'auto'>;

export interface DiagramNode {
  readonly id: string;
  readonly label: string;
  readonly sub: string | null;
  readonly line: number;
}

export interface DiagramEdge {
  readonly from: string;
  readonly to: string;
  readonly label: string | null;
  readonly short: string | null;
  readonly line: number;
}

export type DiagramEdgeMark = 'broken' | 'slow';

export type DiagramNodeMark = 'down' | 'slow';

export type DiagramStateTone = 'neutral' | 'warn' | 'err';

export interface DiagramStateEdge {
  readonly from: string;
  readonly to: string;
  readonly mark: DiagramEdgeMark;
}

export interface DiagramStateNode {
  readonly id: string;
  readonly mark: DiagramNodeMark;
}

export interface DiagramState {
  readonly label: string;
  readonly title: string | null;
  readonly text: string | null;
  readonly hint: string | null;
  readonly path: readonly string[];
  readonly edges: readonly DiagramStateEdge[];
  readonly nodes: readonly DiagramStateNode[];
  readonly line: number;
}

export interface FlowDiagram {
  readonly kind: 'flow';
  readonly id: string;
  readonly title: string | null;
  readonly direction: DiagramDirection;
  readonly nodes: readonly DiagramNode[];
  readonly edges: readonly DiagramEdge[];
  readonly states: readonly DiagramState[];
}

export interface SpectrumZone {
  readonly label: string;
  readonly from: number;
  readonly to: number;
  readonly taste: string | null;
  readonly next: string | null;
  readonly line: number;
}

export interface SpectrumLane {
  readonly label: string;
  readonly from: number;
  readonly to: number;
  readonly line: number;
}

export interface SpectrumDiagram {
  readonly kind: 'spectrum';
  readonly id: string;
  readonly title: string | null;
  readonly axis: { readonly from: string; readonly to: string } | null;
  readonly zones: readonly SpectrumZone[];
  readonly lanes: readonly SpectrumLane[];
}

export type Diagram = FlowDiagram | SpectrumDiagram;

export interface DiagramError {
  readonly line: number;
  readonly message: string;
}

export type DiagramParseResult =
  | { readonly ok: true; readonly diagram: Diagram }
  | { readonly ok: false; readonly errors: readonly DiagramError[] };

export interface DiagramLayoutNode {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface DiagramLayoutLabel {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
}

export interface DiagramLayoutEdge {
  readonly from: string;
  readonly to: string;
  readonly d: string;
  readonly arrow: string;
  readonly tip: { readonly x: number; readonly y: number };
  readonly label: DiagramLayoutLabel | null;
}

export interface DiagramLayout {
  readonly width: number;
  readonly height: number;
  readonly orientation: DiagramOrientation;
  readonly nodes: readonly DiagramLayoutNode[];
  readonly edges: readonly DiagramLayoutEdge[];
}

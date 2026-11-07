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

export interface FlowDiagram {
  readonly kind: 'flow';
  readonly id: string;
  readonly title: string | null;
  readonly direction: DiagramDirection;
  readonly nodes: readonly DiagramNode[];
  readonly edges: readonly DiagramEdge[];
}

export type Diagram = FlowDiagram;

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
  readonly label: DiagramLayoutLabel | null;
}

export interface DiagramLayout {
  readonly width: number;
  readonly height: number;
  readonly orientation: DiagramOrientation;
  readonly nodes: readonly DiagramLayoutNode[];
  readonly edges: readonly DiagramLayoutEdge[];
}

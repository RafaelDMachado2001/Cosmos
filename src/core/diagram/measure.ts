import type { DiagramNode } from './types';

export const DIAGRAM_FONT_PX = { nodeLabel: 13, nodeSub: 11, edgeLabel: 11 } as const;

const MONO_ADVANCE = 0.6;
const NODE_PADDING_X = 30;
const NODE_HEIGHT = 32;
const NODE_HEIGHT_WITH_SUB = 48;
const LABEL_PADDING_X = 16;

export const LABEL_HEIGHT = 20;

export function charCount(text: string): number {
  return [...text].length;
}

export function textWidth(text: string, fontPx: number): number {
  return charCount(text) * MONO_ADVANCE * fontPx;
}

export function nodeSize(node: DiagramNode): { readonly w: number; readonly h: number } {
  const label = textWidth(node.label, DIAGRAM_FONT_PX.nodeLabel);
  const sub = node.sub === null ? 0 : textWidth(node.sub, DIAGRAM_FONT_PX.nodeSub);
  return {
    w: Math.max(label, sub) + NODE_PADDING_X,
    h: node.sub === null ? NODE_HEIGHT : NODE_HEIGHT_WITH_SUB,
  };
}

export function labelWidth(text: string): number {
  return textWidth(text, DIAGRAM_FONT_PX.edgeLabel) + LABEL_PADDING_X;
}

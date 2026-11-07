import { LABEL_HEIGHT, labelWidth, nodeSize } from './measure';
import type { SequenceDiagram, SequenceLayout, SequenceLayoutMessage } from './types';

const MARGIN = 16;
const COLUMN_GAP = 28;
const LABEL_SIDE_GAP = 24;
const ROW_HEIGHT = 44;
const SELF_WIDTH = 28;
const SELF_HEIGHT = 20;
const SELF_LABEL_GAP = 8;
const FIRST_ROW_GAP = 34;
const LIFELINE_TAIL = 22;
const ARROW_LENGTH = 8;
const ARROW_HALF_BASE = 4;

function round(value: number): number {
  return Math.round(value * 10) / 10 + 0;
}

function arrowPoints(tipX: number, y: number, direction: number): string {
  const baseX = tipX - direction * ARROW_LENGTH;
  return [
    [tipX, y],
    [baseX, y + ARROW_HALF_BASE],
    [baseX, y - ARROW_HALF_BASE],
  ]
    .map(([x, pointY]) => `${String(round(x ?? 0))},${String(round(pointY ?? 0))}`)
    .join(' ');
}

export function layoutSequence(diagram: SequenceDiagram): SequenceLayout {
  const sizes = diagram.participants.map(nodeSize);
  const position = new Map(diagram.participants.map((participant, index) => [participant.id, index]));
  const gaps = sizes.slice(1).map((size, index) => ((sizes[index]?.w ?? 0) + size.w) / 2 + COLUMN_GAP);
  const selfRoom = diagram.participants.map(() => 0);

  for (const message of diagram.messages) {
    const from = position.get(message.from) ?? 0;
    const to = position.get(message.to) ?? 0;
    const width = message.label === null ? 0 : labelWidth(message.label);
    if (from === to) {
      const room = SELF_WIDTH + (width === 0 ? 0 : SELF_LABEL_GAP + width);
      selfRoom[from] = Math.max(selfRoom[from] ?? 0, room);
      continue;
    }
    const left = Math.min(from, to);
    const right = Math.max(from, to);
    const span = gaps.slice(left, right).reduce((sum, gap) => sum + gap, 0);
    const missing = width + LABEL_SIDE_GAP * 2 - span;
    if (missing <= 0) continue;
    for (let gap = left; gap < right; gap += 1) gaps[gap] = (gaps[gap] ?? 0) + missing / (right - left);
  }

  selfRoom.forEach((room, index) => {
    if (index < gaps.length) gaps[index] = Math.max(gaps[index] ?? 0, room + (sizes[index + 1]?.w ?? 0) / 2 + COLUMN_GAP);
  });

  const columns: number[] = [MARGIN + (sizes[0]?.w ?? 0) / 2];
  gaps.forEach((gap, index) => {
    columns.push((columns[index] ?? 0) + gap);
  });

  const headerHeight = Math.max(...sizes.map((size) => size.h));
  const headerCenter = MARGIN + headerHeight / 2;
  const lifelineStart = MARGIN + headerHeight;

  let cursor = lifelineStart + FIRST_ROW_GAP;
  const messages = diagram.messages.map((message): SequenceLayoutMessage => {
    const fromX = columns[position.get(message.from) ?? 0] ?? 0;
    const toX = columns[position.get(message.to) ?? 0] ?? 0;
    const y = cursor;

    if (fromX === toX) {
      cursor += ROW_HEIGHT + SELF_HEIGHT;
      const right = fromX + SELF_WIDTH;
      const bottom = y + SELF_HEIGHT;
      const width = message.label === null ? 0 : labelWidth(message.label);
      return {
        d: `M${String(round(fromX))},${String(round(y))} L${String(round(right))},${String(round(y))} L${String(round(right))},${String(round(bottom))} L${String(round(fromX))},${String(round(bottom))}`,
        arrow: arrowPoints(fromX, bottom, -1),
        reply: false,
        label:
          message.label === null
            ? null
            : {
                text: message.label,
                x: round(right + SELF_LABEL_GAP + width / 2),
                y: round(y + SELF_HEIGHT / 2),
                w: round(width),
              },
      };
    }

    cursor += ROW_HEIGHT;
    return {
      d: `M${String(round(fromX))},${String(round(y))} L${String(round(toX))},${String(round(y))}`,
      arrow: arrowPoints(toX, y, Math.sign(toX - fromX)),
      reply: message.reply,
      label:
        message.label === null
          ? null
          : { text: message.label, x: round((fromX + toX) / 2), y: round(y), w: round(labelWidth(message.label)) },
    };
  });

  const lifelineEnd = cursor - ROW_HEIGHT + LIFELINE_TAIL + LABEL_HEIGHT / 2;
  const rightEdges = columns.map(
    (column, index) => column + Math.max((sizes[index]?.w ?? 0) / 2, selfRoom[index] ?? 0),
  );

  return {
    width: round(Math.max(...rightEdges) + MARGIN),
    height: round(lifelineEnd + MARGIN),
    participants: diagram.participants.map((participant, index) => ({
      id: participant.id,
      x: round(columns[index] ?? 0),
      y: round(headerCenter),
      w: round(sizes[index]?.w ?? 0),
      h: round(sizes[index]?.h ?? 0),
    })),
    lifelines: columns.map((column) => ({
      x: round(column),
      top: round(lifelineStart),
      bottom: round(lifelineEnd),
    })),
    messages,
  };
}

import { LABEL_HEIGHT, labelWidth, nodeSize } from './measure';
import type {
  Diagram,
  DiagramLayout,
  DiagramLayoutEdge,
  DiagramLayoutLabel,
  DiagramLayoutNode,
  DiagramOrientation,
  FlowDiagram,
} from './types';

export const DIAGRAM_MAX_WIDTH = 1180;

const MARGIN = 16;
const CROSS_SPACING: Readonly<Record<DiagramOrientation, number>> = { right: 28, down: 24 };
const MIN_GAP: Readonly<Record<DiagramOrientation, number>> = { right: 72, down: 64 };
const LABEL_CLEARANCE = 12;
const ELBOW_LABEL_CLEARANCE = 32;
const TRUNK_INSET = 16;
const LABEL_STACK_GAP = 8;
const LABEL_CROSS_GAP = 6;
const CORNER_RADIUS = 12;
const ARROW_LENGTH = 8;
const ARROW_HALF_BASE = 4;
const SAME_POSITION = 0.5;

interface Item {
  readonly id: string;
  readonly rank: number;
  readonly order: number;
  readonly mainSize: number;
  readonly crossSize: number;
  readonly parents: Item[];
  readonly children: Item[];
  index: number;
  cross: number;
}

interface Link {
  readonly from: Item;
  readonly to: Item;
  readonly first: boolean;
  readonly last: boolean;
  readonly text: string | null;
}

interface Slot {
  readonly link: Link;
  readonly text: string;
  readonly width: number;
  readonly cross: number;
  readonly crossHalf: number;
  readonly mainSize: number;
  offset: number;
}

interface Gap {
  readonly slots: readonly Slot[];
  readonly used: number;
  readonly clearance: number;
  readonly size: number;
}

interface Point {
  readonly x: number;
  readonly y: number;
}

function round(value: number): number {
  return Math.round(value * 10) / 10 + 0;
}

function ranks(diagram: FlowDiagram): ReadonlyMap<string, number> {
  const rank = new Map(diagram.nodes.map((node) => [node.id, 0]));
  const pending = new Map(diagram.nodes.map((node) => [node.id, 0]));
  for (const edge of diagram.edges) pending.set(edge.to, (pending.get(edge.to) ?? 0) + 1);

  const ready = diagram.nodes.map((node) => node.id).filter((id) => pending.get(id) === 0);
  for (const id of ready) {
    for (const edge of diagram.edges) {
      if (edge.from !== id) continue;
      rank.set(edge.to, Math.max(rank.get(edge.to) ?? 0, (rank.get(id) ?? 0) + 1));
      const left = (pending.get(edge.to) ?? 0) - 1;
      pending.set(edge.to, left);
      if (left === 0) ready.push(edge.to);
    }
  }
  return rank;
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sortLayer(layer: Item[]): void {
  const barycenter = (item: Item): number =>
    item.parents.length === 0 ? item.order : mean(item.parents.map((parent) => parent.index));
  layer.sort((a, b) => barycenter(a) - barycenter(b) || a.order - b.order);
  layer.forEach((item, index) => {
    item.index = index;
  });
}

function placeLayer(layer: readonly Item[], spacing: number): void {
  const wanted = layer.map((item) =>
    item.parents.length === 0 ? 0 : mean(item.parents.map((parent) => parent.cross)),
  );

  let previous: Item | null = null;
  layer.forEach((item, index) => {
    const floor =
      previous === null ? -Infinity : previous.cross + (previous.crossSize + item.crossSize) / 2 + spacing;
    item.cross = Math.max(wanted[index] ?? 0, floor);
    previous = item;
  });

  const shift = mean(wanted) - mean(layer.map((item) => item.cross));
  for (const item of layer) item.cross += shift;
}

function isElbow(link: Link): boolean {
  return Math.abs(link.from.cross - link.to.cross) > SAME_POSITION;
}

function trunkNearTarget(link: Link): boolean {
  return link.to.parents.length > 1 && link.from.children.length === 1;
}

function buildGap(links: readonly Link[], orientation: DiagramOrientation): Gap {
  const slots: Slot[] = [];
  for (const link of links) {
    if (link.text === null) continue;
    const width = labelWidth(link.text);
    slots.push({
      link,
      text: link.text,
      width,
      cross: trunkNearTarget(link) ? link.from.cross : link.to.cross,
      crossHalf: orientation === 'right' ? LABEL_HEIGHT / 2 : width / 2,
      mainSize: orientation === 'right' ? width : LABEL_HEIGHT,
      offset: 0,
    });
  }

  const placed: Slot[] = [];
  for (const slot of slots) {
    let moved = true;
    while (moved) {
      moved = false;
      for (const other of placed) {
        const crossClash = Math.abs(slot.cross - other.cross) < slot.crossHalf + other.crossHalf + LABEL_CROSS_GAP;
        const mainClash =
          slot.offset < other.offset + other.mainSize + LABEL_STACK_GAP &&
          other.offset < slot.offset + slot.mainSize + LABEL_STACK_GAP;
        if (crossClash && mainClash) {
          slot.offset = other.offset + other.mainSize + LABEL_STACK_GAP;
          moved = true;
        }
      }
    }
    placed.push(slot);
  }

  const used = Math.max(0, ...slots.map((slot) => slot.offset + slot.mainSize));
  const clearance = links.some(isElbow) ? ELBOW_LABEL_CLEARANCE : LABEL_CLEARANCE;
  return { slots, used, clearance, size: 0 };
}

function withoutRedundantPoints(points: readonly Point[]): readonly Point[] {
  const distinct = points.filter((point, index) => {
    const previous = points[index - 1];
    return (
      previous === undefined ||
      Math.abs(point.x - previous.x) > 0.05 ||
      Math.abs(point.y - previous.y) > 0.05
    );
  });

  return distinct.filter((point, index) => {
    const before = distinct[index - 1];
    const after = distinct[index + 1];
    if (before === undefined || after === undefined) return true;
    const sameX = Math.abs(before.x - point.x) < 0.05 && Math.abs(point.x - after.x) < 0.05;
    const sameY = Math.abs(before.y - point.y) < 0.05 && Math.abs(point.y - after.y) < 0.05;
    return !sameX && !sameY;
  });
}

function pathData(points: readonly Point[]): string {
  const [start] = points;
  if (start === undefined) return '';
  const parts = [`M${String(round(start.x))},${String(round(start.y))}`];

  for (let index = 1; index < points.length - 1; index += 1) {
    const before = points[index - 1];
    const corner = points[index];
    const after = points[index + 1];
    if (before === undefined || corner === undefined || after === undefined) continue;
    const inLength = Math.hypot(corner.x - before.x, corner.y - before.y);
    const outLength = Math.hypot(after.x - corner.x, after.y - corner.y);
    const radius = Math.min(CORNER_RADIUS, inLength / 2, outLength / 2);
    const enterX = corner.x - ((corner.x - before.x) / inLength) * radius;
    const enterY = corner.y - ((corner.y - before.y) / inLength) * radius;
    const leaveX = corner.x + ((after.x - corner.x) / outLength) * radius;
    const leaveY = corner.y + ((after.y - corner.y) / outLength) * radius;
    parts.push(
      `L${String(round(enterX))},${String(round(enterY))}`,
      `Q${String(round(corner.x))},${String(round(corner.y))} ${String(round(leaveX))},${String(round(leaveY))}`,
    );
  }

  const end = points[points.length - 1];
  if (end !== undefined) parts.push(`L${String(round(end.x))},${String(round(end.y))}`);
  return parts.join(' ');
}

function arrowPoints(points: readonly Point[]): readonly Point[] {
  const tip = points[points.length - 1];
  const before = points[points.length - 2];
  if (tip === undefined || before === undefined) return [];
  const length = Math.hypot(tip.x - before.x, tip.y - before.y);
  const unitX = (tip.x - before.x) / length;
  const unitY = (tip.y - before.y) / length;
  const baseX = tip.x - unitX * ARROW_LENGTH;
  const baseY = tip.y - unitY * ARROW_LENGTH;
  return [
    tip,
    { x: baseX - unitY * ARROW_HALF_BASE, y: baseY + unitX * ARROW_HALF_BASE },
    { x: baseX + unitY * ARROW_HALF_BASE, y: baseY - unitX * ARROW_HALF_BASE },
  ];
}

export function layoutDiagram(diagram: FlowDiagram, orientation: DiagramOrientation): DiagramLayout {
  const rankOf = ranks(diagram);
  const horizontal = orientation === 'right';

  let order = 0;
  const createItem = (id: string, rank: number, mainSize: number, crossSize: number): Item => ({
    id,
    rank,
    order: order++,
    mainSize,
    crossSize,
    parents: [],
    children: [],
    index: 0,
    cross: 0,
  });

  const items = new Map<string, Item>();
  for (const node of diagram.nodes) {
    const { w, h } = nodeSize(node);
    const rank = rankOf.get(node.id) ?? 0;
    items.set(node.id, createItem(node.id, rank, horizontal ? w : h, horizontal ? h : w));
  }

  const chains = diagram.edges.map((edge, edgeIndex) => {
    const source = items.get(edge.from);
    const target = items.get(edge.to);
    if (source === undefined || target === undefined) return [];
    const virtual: Item[] = [];
    for (let rank = source.rank + 1; rank < target.rank; rank += 1) {
      virtual.push(createItem(`${String(edgeIndex)}:${String(rank)}`, rank, 0, 0));
    }
    return [source, ...virtual, target];
  });

  const links = chains.map((chain, edgeIndex): readonly Link[] => {
    const edge = diagram.edges[edgeIndex];
    const text = horizontal ? (edge?.label ?? null) : (edge?.short ?? edge?.label ?? null);
    return chain.slice(1).map((to, index) => {
      const from = chain[index] as Item;
      from.children.push(to);
      to.parents.push(from);
      return { from, to, first: index === 0, last: index === chain.length - 2, text: index === 0 ? text : null };
    });
  });

  const everyItem = [...new Set([...items.values(), ...chains.flat()])];
  const rankCount = Math.max(...everyItem.map((item) => item.rank)) + 1;
  const layers = Array.from({ length: rankCount }, (_, rank) => everyItem.filter((item) => item.rank === rank));

  for (const layer of layers) {
    sortLayer(layer);
    placeLayer(layer, CROSS_SPACING[orientation]);
  }

  const linksByGap = layers.map((_, rank) => links.flat().filter((link) => link.from.rank === rank));
  const gaps = linksByGap.map((gapLinks): Gap => {
    const gap = buildGap(gapLinks, orientation);
    return { ...gap, size: Math.max(MIN_GAP[orientation], gap.used + gap.clearance * 2) };
  });

  const bandStart: number[] = [];
  const bandSize = layers.map((layer) => Math.max(...layer.map((item) => item.mainSize)));
  let cursor = 0;
  bandSize.forEach((size, rank) => {
    bandStart[rank] = cursor;
    cursor += size + (gaps[rank]?.size ?? 0);
  });

  const start = (rank: number): number => bandStart[rank] ?? 0;
  const end = (rank: number): number => start(rank) + (bandSize[rank] ?? 0);
  const center = (rank: number): number => start(rank) + (bandSize[rank] ?? 0) / 2;
  const toPoint = (main: number, cross: number): Point => (horizontal ? { x: main, y: cross } : { x: cross, y: main });

  const trunkAt = (link: Link): number => {
    const from = end(link.from.rank);
    const to = start(link.to.rank);
    if (trunkNearTarget(link)) return to - TRUNK_INSET;
    const free = link.from.children.length === 1 && (gaps[link.from.rank]?.slots.length ?? 0) === 0;
    return free ? (from + to) / 2 : from + TRUNK_INSET;
  };

  const routes = links.map((chain) => {
    const points: Point[] = [];
    for (const link of chain) {
      const leave = link.first ? center(link.from.rank) + link.from.mainSize / 2 : end(link.from.rank);
      const arrive = link.last ? center(link.to.rank) - link.to.mainSize / 2 : start(link.to.rank);
      points.push(toPoint(leave, link.from.cross));
      if (isElbow(link)) {
        const trunk = trunkAt(link);
        points.push(toPoint(trunk, link.from.cross), toPoint(trunk, link.to.cross));
      }
      points.push(toPoint(arrive, link.to.cross));
    }
    return withoutRedundantPoints(points);
  });

  const labels = new Map<Link, DiagramLayoutLabel>();
  gaps.forEach((gap, rank) => {
    const room = gap.size - gap.clearance * 2;
    const stacked = gap.slots.some((slot) => slot.offset > 0);
    for (const slot of gap.slots) {
      const lead = stacked ? (room - gap.used) / 2 + slot.offset : (room - slot.mainSize) / 2;
      const main = end(rank) + gap.clearance + lead + slot.mainSize / 2;
      const point = toPoint(main, slot.cross);
      labels.set(slot.link, { text: slot.text, x: point.x, y: point.y, w: slot.width });
    }
  });

  const nodeBoxes = diagram.nodes.flatMap((node): DiagramLayoutNode[] => {
    const item = items.get(node.id);
    if (item === undefined) return [];
    const { w, h } = nodeSize(node);
    const point = toPoint(center(item.rank), item.cross);
    return [{ id: node.id, x: point.x, y: point.y, w, h }];
  });

  const xs: number[] = [];
  const ys: number[] = [];
  for (const box of nodeBoxes) {
    xs.push(box.x - box.w / 2, box.x + box.w / 2);
    ys.push(box.y - box.h / 2, box.y + box.h / 2);
  }
  for (const label of labels.values()) {
    xs.push(label.x - label.w / 2, label.x + label.w / 2);
    ys.push(label.y - LABEL_HEIGHT / 2, label.y + LABEL_HEIGHT / 2);
  }
  for (const point of routes.flat()) {
    xs.push(point.x);
    ys.push(point.y);
  }

  const left = Math.min(...xs) - MARGIN;
  const top = Math.min(...ys) - MARGIN;
  const shift = (point: Point): Point => ({ x: point.x - left, y: point.y - top });

  const edges = diagram.edges.map((edge, index): DiagramLayoutEdge => {
    const route = (routes[index] ?? []).map(shift);
    const label = (links[index] ?? []).map((link) => labels.get(link)).find((entry) => entry !== undefined);
    const tip = route.at(-1) ?? { x: 0, y: 0 };
    return {
      from: edge.from,
      to: edge.to,
      d: pathData(route),
      arrow: arrowPoints(route)
        .map((point) => `${String(round(point.x))},${String(round(point.y))}`)
        .join(' '),
      tip: { x: round(tip.x), y: round(tip.y) },
      label:
        label === undefined
          ? null
          : {
              text: label.text,
              x: round(label.x - left),
              y: round(label.y - top),
              w: round(label.w),
            },
    };
  });

  return {
    width: round(Math.max(...xs) + MARGIN - left),
    height: round(Math.max(...ys) + MARGIN - top),
    orientation,
    nodes: nodeBoxes.map((box) => ({
      id: box.id,
      x: round(box.x - left),
      y: round(box.y - top),
      w: round(box.w),
      h: round(box.h),
    })),
    edges,
  };
}

export function diagramLayouts(diagram: Diagram): readonly DiagramLayout[] {
  if (diagram.direction !== 'auto') return [layoutDiagram(diagram, diagram.direction)];
  const wide = layoutDiagram(diagram, 'right');
  const narrow = layoutDiagram(diagram, 'down');
  return wide.width > DIAGRAM_MAX_WIDTH ? [narrow] : [wide, narrow];
}

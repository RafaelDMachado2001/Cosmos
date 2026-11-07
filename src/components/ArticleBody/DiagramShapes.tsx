import styles from './ArticleBody.module.css';
import { LABEL_HEIGHT } from '../../core/diagram/measure';
import type { DiagramLayoutLabel, DiagramLayoutNode } from '../../core/diagram/types';

const NODE_RADIUS = 14;
const LABEL_BASELINE = 3.9;
const NODE_BASELINE = 4.5;
const NODE_BASELINE_WITH_SUB = -2;
const SUB_BASELINE = 14;

interface NodeBoxProps {
  readonly box: DiagramLayoutNode;
  readonly node: { readonly label: string; readonly sub: string | null } | undefined;
  readonly tone?: string;
}

export function NodeBox({ box, node, tone }: NodeBoxProps) {
  const sub = node?.sub ?? null;
  return (
    <g data-tone={tone}>
      <rect
        className={styles.diagramNode}
        x={box.x - box.w / 2}
        y={box.y - box.h / 2}
        width={box.w}
        height={box.h}
        rx={NODE_RADIUS}
      />
      <text
        className={styles.diagramNodeLabel}
        x={box.x}
        y={box.y + (sub === null ? NODE_BASELINE : NODE_BASELINE_WITH_SUB)}
        textAnchor="middle"
      >
        {node?.label}
      </text>
      {sub !== null && (
        <text className={styles.diagramNodeSub} x={box.x} y={box.y + SUB_BASELINE} textAnchor="middle">
          {sub}
        </text>
      )}
    </g>
  );
}

interface LabelPillProps {
  readonly label: DiagramLayoutLabel | null;
  readonly tone?: string;
}

export function LabelPill({ label, tone }: LabelPillProps) {
  if (label === null) return null;
  return (
    <g data-tone={tone}>
      <rect
        className={styles.diagramLabel}
        x={label.x - label.w / 2}
        y={label.y - LABEL_HEIGHT / 2}
        width={label.w}
        height={LABEL_HEIGHT}
        rx={LABEL_HEIGHT / 2}
      />
      <text className={styles.diagramLabelText} x={label.x} y={label.y + LABEL_BASELINE} textAnchor="middle">
        {label.text}
      </text>
    </g>
  );
}

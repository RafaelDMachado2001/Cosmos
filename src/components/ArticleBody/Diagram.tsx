import { useContext } from 'react';

import styles from './ArticleBody.module.css';
import { describeDiagram } from '../../core/diagram/describe';
import { diagramLayouts } from '../../core/diagram/layout';
import { LABEL_HEIGHT } from '../../core/diagram/measure';
import type { Diagram as DiagramModel, DiagramLayout } from '../../core/diagram/types';
import { LocaleContext } from '../../i18n/LocaleContext';

export interface DiagramProps {
  readonly diagram: DiagramModel;
  readonly instance: string;
}

const NODE_RADIUS = 14;
const LABEL_BASELINE = 3.9;
const NODE_BASELINE = 4.5;
const NODE_BASELINE_WITH_SUB = -2;
const SUB_BASELINE = 14;

interface DiagramSvgProps {
  readonly diagram: DiagramModel;
  readonly layout: DiagramLayout;
  readonly description: string;
  readonly baseId: string;
}

function DiagramSvg({ diagram, layout, description, baseId }: DiagramSvgProps) {
  const titleId = `${baseId}-title`;
  const descId = `${baseId}-desc`;
  const labelledBy = diagram.title === null ? descId : `${titleId} ${descId}`;
  const nodes = new Map(diagram.nodes.map((node) => [node.id, node]));

  return (
    <svg
      className={styles.diagramSvg}
      viewBox={`0 0 ${String(layout.width)} ${String(layout.height)}`}
      width={layout.width}
      height={layout.height}
      role="img"
      aria-labelledby={labelledBy}
    >
      {diagram.title !== null && <title id={titleId}>{diagram.title}</title>}
      <desc id={descId}>{description}</desc>

      {layout.edges.map((edge) => (
        <g key={`${edge.from}-${edge.to}`}>
          <path className={styles.diagramWire} d={edge.d} />
          <polygon className={styles.diagramArrow} points={edge.arrow} />
        </g>
      ))}

      {layout.nodes.map((box) => {
        const node = nodes.get(box.id);
        const sub = node?.sub ?? null;
        return (
          <g key={box.id}>
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
      })}

      {layout.edges.map(
        (edge) =>
          edge.label !== null && (
            <g key={`${edge.from}-${edge.to}-label`}>
              <rect
                className={styles.diagramLabel}
                x={edge.label.x - edge.label.w / 2}
                y={edge.label.y - LABEL_HEIGHT / 2}
                width={edge.label.w}
                height={LABEL_HEIGHT}
                rx={LABEL_HEIGHT / 2}
              />
              <text
                className={styles.diagramLabelText}
                x={edge.label.x}
                y={edge.label.y + LABEL_BASELINE}
                textAnchor="middle"
              >
                {edge.label.text}
              </text>
            </g>
          ),
      )}
    </svg>
  );
}

export function Diagram({ diagram, instance }: DiagramProps) {
  const vocabulary = useContext(LocaleContext)?.t.diagram;
  const layouts = diagramLayouts(diagram);
  const description = describeDiagram(diagram, vocabulary);
  const swaps = layouts.length > 1;

  return (
    <figure className={swaps ? `${styles.diagram} ${styles.diagramSwap}` : styles.diagram}>
      {layouts.map((layout) => (
        <div key={layout.orientation} className={styles.diagramScroll} data-orientation={layout.orientation} tabIndex={0}>
          <DiagramSvg
            diagram={diagram}
            layout={layout}
            description={description}
            baseId={`${diagram.id}-${instance}-${layout.orientation}`}
          />
        </div>
      ))}
      {diagram.title !== null && <figcaption className={styles.diagramCaption}>{diagram.title}</figcaption>}
    </figure>
  );
}

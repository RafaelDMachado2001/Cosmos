import { useContext } from 'react';

import styles from './ArticleBody.module.css';
import { LabelPill, NodeBox } from './DiagramShapes';
import { describeSequence } from '../../core/diagram/describe';
import { layoutSequence } from '../../core/diagram/sequence';
import type { SequenceDiagram } from '../../core/diagram/types';
import { LocaleContext } from '../../i18n/LocaleContext';
import { pt } from '../../i18n/pt';

export interface SequenceProps {
  readonly diagram: SequenceDiagram;
  readonly instance: string;
}

export function Sequence({ diagram, instance }: SequenceProps) {
  const words = useContext(LocaleContext)?.t.diagram ?? pt.diagram;
  const layout = layoutSequence(diagram);
  const baseId = `${diagram.id}-${instance}`;
  const titleId = `${baseId}-title`;
  const descId = `${baseId}-desc`;

  return (
    <figure className={styles.diagram}>
      <div className={styles.diagramScroll} tabIndex={0}>
        <svg
          className={styles.diagramSvg}
          viewBox={`0 0 ${String(layout.width)} ${String(layout.height)}`}
          width={layout.width}
          height={layout.height}
          role="img"
          aria-labelledby={diagram.title === null ? descId : `${titleId} ${descId}`}
        >
          {diagram.title !== null && <title id={titleId}>{diagram.title}</title>}
          <desc id={descId}>{describeSequence(diagram, words)}</desc>

          {layout.lifelines.map((lifeline) => (
            <line
              key={lifeline.x}
              className={styles.diagramLifeline}
              x1={lifeline.x}
              x2={lifeline.x}
              y1={lifeline.top}
              y2={lifeline.bottom}
            />
          ))}
          {layout.participants.map((box, index) => (
            <NodeBox key={box.id} box={box} node={diagram.participants[index]} />
          ))}
          {layout.messages.map((message, index) => (
            <g key={index} data-reply={message.reply ? '' : undefined}>
              <path className={styles.diagramWire} d={message.d} />
              <polygon className={styles.diagramArrow} points={message.arrow} />
              <LabelPill label={message.label} />
            </g>
          ))}
        </svg>
      </div>
      {diagram.title !== null && <figcaption className={styles.diagramCaption}>{diagram.title}</figcaption>}
    </figure>
  );
}

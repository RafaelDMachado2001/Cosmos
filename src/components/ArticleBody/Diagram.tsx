import { useContext } from 'react';

import styles from './ArticleBody.module.css';
import { LabelPill, NodeBox } from './DiagramShapes';
import { Sequence } from './Sequence';
import { Spectrum } from './Spectrum';
import { describeDiagram } from '../../core/diagram/describe';
import { diagramLayouts } from '../../core/diagram/layout';
import { diagramStateLayer, diagramStateTone } from '../../core/diagram/state';
import type { DiagramEdgeTone, DiagramLayerBadge } from '../../core/diagram/state';
import type {
  Diagram as DiagramModel,
  FlowDiagram,
  DiagramLayout,
  DiagramLayoutEdge,
} from '../../core/diagram/types';
import { LocaleContext } from '../../i18n/LocaleContext';
import { pt } from '../../i18n/pt';

export interface DiagramProps {
  readonly diagram: DiagramModel;
  readonly instance: string;
}

const PACKET_RADIUS = 4.5;
const BADGE_RADIUS = 8;
const BADGE_GLYPH = 3;

interface DiagramSvgProps {
  readonly diagram: FlowDiagram;
  readonly layout: DiagramLayout;
  readonly description: string;
  readonly baseId: string;
}

interface EdgeWireProps {
  readonly edge: DiagramLayoutEdge;
  readonly tone?: DiagramEdgeTone;
  readonly touched?: string;
}

function EdgeWire({ edge, tone, touched }: EdgeWireProps) {
  return (
    <g data-tone={tone} data-touched={touched === '' ? undefined : touched}>
      <path className={styles.diagramWire} d={edge.d} />
      <polygon className={styles.diagramArrow} points={edge.arrow} />
    </g>
  );
}

function DiagramBadge({ badge }: { readonly badge: DiagramLayerBadge }) {
  const { x, y, tone } = badge;
  const glyph =
    tone === 'err'
      ? `M${String(x - BADGE_GLYPH)},${String(y - BADGE_GLYPH)} L${String(x + BADGE_GLYPH)},${String(y + BADGE_GLYPH)} M${String(x + BADGE_GLYPH)},${String(y - BADGE_GLYPH)} L${String(x - BADGE_GLYPH)},${String(y + BADGE_GLYPH)}`
      : `M${String(x)},${String(y - BADGE_GLYPH - 1)} L${String(x)},${String(y)} L${String(x + BADGE_GLYPH)},${String(y + 2)}`;
  return (
    <g className={styles.diagramBadge} data-badge={tone} data-tone={tone}>
      <circle cx={x} cy={y} r={BADGE_RADIUS} />
      <path d={glyph} />
    </g>
  );
}

function stateNumber(index: number): string {
  return String(index + 1);
}

function DiagramSvg({ diagram, layout, description, baseId }: DiagramSvgProps) {
  const titleId = `${baseId}-title`;
  const descId = `${baseId}-desc`;
  const labelledBy = diagram.title === null ? descId : `${titleId} ${descId}`;
  const nodes = new Map(diagram.nodes.map((node) => [node.id, node]));
  const layers = diagram.states.map((state) => diagramStateLayer(state, layout));
  const touchedBy = (edge: DiagramLayoutEdge): string =>
    layers.flatMap((layer, index) => (layer.edges.some((item) => item.edge === edge) ? [stateNumber(index)] : [])).join(' ');

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

      <g className={styles.diagramBase}>
        {layout.edges.map((edge) => (
          <EdgeWire key={`${edge.from}-${edge.to}`} edge={edge} touched={touchedBy(edge)} />
        ))}
        {layout.nodes.map((box) => (
          <NodeBox key={box.id} box={box} node={nodes.get(box.id)} />
        ))}
        {layout.edges.map((edge) => (
          <LabelPill key={`${edge.from}-${edge.to}-label`} label={edge.label} />
        ))}
      </g>

      {layers.map((layer, index) => (
        <g key={index} className={styles.diagramLayer} data-state={stateNumber(index)}>
          {layer.edges.map(({ edge, tone }) => (
            <EdgeWire key={`${edge.from}-${edge.to}`} edge={edge} tone={tone} />
          ))}
          {layer.nodes.map(({ node, tone }) => (
            <NodeBox key={node.id} box={node} node={nodes.get(node.id)} tone={tone} />
          ))}
          {layer.edges.map(({ edge, tone }) => (
            <LabelPill key={`${edge.from}-${edge.to}-label`} label={edge.label} tone={tone} />
          ))}
          {layer.badges.map((badge) => (
            <DiagramBadge key={badge.key} badge={badge} />
          ))}
          {layer.route !== null && (
            <circle
              className={styles.diagramPacket}
              r={PACKET_RADIUS}
              data-tone={layer.tone}
              style={{ offsetPath: `path('${layer.route}')` }}
            />
          )}
        </g>
      ))}
    </svg>
  );
}

interface DiagramStatesProps {
  readonly diagram: FlowDiagram;
  readonly group: string;
  readonly overview: string;
  readonly label: string;
}

function DiagramTabs({ diagram, group, overview, label }: DiagramStatesProps) {
  return (
    <div className={styles.diagramTabs} role="radiogroup" aria-label={label}>
      <label className={styles.diagramTab}>
        <input className={styles.diagramRadio} type="radio" name={group} data-state="0" defaultChecked />
        <span>{overview}</span>
      </label>
      {diagram.states.map((state, index) => (
        <label key={state.label} className={styles.diagramTab} data-tone={diagramStateTone(state)}>
          <input className={styles.diagramRadio} type="radio" name={group} data-state={stateNumber(index)} />
          <span>{state.label}</span>
        </label>
      ))}
    </div>
  );
}

function DiagramPanels({ diagram }: { readonly diagram: FlowDiagram }) {
  return (
    <div aria-live="polite">
      {diagram.states.map(
        (state, index) =>
          (state.title !== null || state.text !== null || state.hint !== null) && (
            <div
              key={state.label}
              className={styles.diagramLayer}
              data-state={stateNumber(index)}
              data-tone={diagramStateTone(state)}
            >
              <div className={styles.diagramStatus}>
                <p className={styles.diagramStatusCode}>{state.label}</p>
                <div>
                  {state.title !== null && <p className={styles.diagramStatusTitle}>{state.title}</p>}
                  {state.text !== null && <p className={styles.diagramStatusText}>{state.text}</p>}
                  {state.hint !== null && <p className={styles.diagramStatusHint}>{state.hint}</p>}
                </div>
              </div>
            </div>
          ),
      )}
    </div>
  );
}

function FlowFigure({ diagram, instance }: { readonly diagram: FlowDiagram; readonly instance: string }) {
  const words = useContext(LocaleContext)?.t.diagram ?? pt.diagram;
  const layouts = diagramLayouts(diagram);
  const description = describeDiagram(diagram, words);
  const swaps = layouts.length > 1;
  const hasStates = diagram.states.length > 0;

  return (
    <figure className={swaps ? `${styles.diagram} ${styles.diagramSwap}` : styles.diagram}>
      {hasStates && (
        <DiagramTabs
          diagram={diagram}
          group={`${diagram.id}-${instance}`}
          overview={words.overview}
          label={words.scenarios}
        />
      )}
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
      {hasStates && <DiagramPanels diagram={diagram} />}
      {diagram.title !== null && <figcaption className={styles.diagramCaption}>{diagram.title}</figcaption>}
    </figure>
  );
}

export function Diagram({ diagram, instance }: DiagramProps) {
  if (diagram.kind === 'spectrum') return <Spectrum diagram={diagram} instance={instance} />;
  if (diagram.kind === 'sequence') return <Sequence diagram={diagram} instance={instance} />;
  return <FlowFigure diagram={diagram} instance={instance} />;
}

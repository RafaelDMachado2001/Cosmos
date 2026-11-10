import styles from './ArticleBody.module.css';
import type { LayerBand, LayerChild, LayerNode, LayersDiagram } from '../../core/diagram/types';

export interface LayersProps {
  readonly diagram: LayersDiagram;
  readonly instance: string;
}

function classes(...names: readonly (string | false | undefined)[]): string {
  return names.filter((name) => typeof name === 'string' && name !== '').join(' ');
}

function Pills({ items, labelledBy }: { readonly items: readonly string[]; readonly labelledBy?: string }) {
  return (
    <ul className={styles.layerItems} aria-labelledby={labelledBy}>
      {items.map((item, index) => (
        <li key={`${item}-${String(index)}`} className={styles.layerPill}>
          {item}
        </li>
      ))}
    </ul>
  );
}

function Header({ id, name, note }: { readonly id: string; readonly name: string; readonly note: string | null }) {
  return (
    <div className={styles.layerHeader}>
      <span id={id} className={styles.layerName}>
        {name}
      </span>
      {note !== null && <span className={styles.layerNote}>{note}</span>}
    </div>
  );
}

function Child({ child, baseId }: { readonly child: LayerChild; readonly baseId: string }) {
  if (child.kind === 'layer') return <Layer node={child} baseId={baseId} onBase={false} />;
  if (child.kind === 'items') return <Pills items={child.items} />;
  const labelId = `${baseId}-group-${String(child.line)}`;
  return (
    <div className={classes(styles.layerGroup, child.highlight && styles.layerHighlight)}>
      <span id={labelId} className={styles.layerGroupName}>
        {child.name}
      </span>
      <Pills items={child.items} labelledBy={labelId} />
    </div>
  );
}

function Layer({ node, baseId, onBase }: { readonly node: LayerNode; readonly baseId: string; readonly onBase: boolean }) {
  const nameId = `${baseId}-layer-${node.id}`;
  return (
    <div
      role="group"
      aria-labelledby={nameId}
      className={classes(
        styles.layer,
        styles[`depth-${String(node.depth)}`],
        node.highlight && styles.layerHighlight,
        onBase && styles.layerOnBase,
      )}
    >
      <Header id={nameId} name={node.name} note={node.note} />
      {node.children.map((child) => (
        <Child key={child.line} child={child} baseId={baseId} />
      ))}
    </div>
  );
}

function Band({ band, id, className }: { readonly band: LayerBand; readonly id: string; readonly className: string | undefined }) {
  return (
    <div role="group" aria-labelledby={id} className={className}>
      <Header id={id} name={band.name} note={band.note} />
      <Pills items={band.items} />
    </div>
  );
}

export function Layers({ diagram, instance }: LayersProps) {
  const baseId = `${diagram.id}-${instance}`;
  return (
    <figure className={classes(styles.diagram, styles.layers)}>
      <div className={styles.layersBody}>
        <div className={styles.layersStack}>
          <Layer node={diagram.root} baseId={baseId} onBase={diagram.base !== null} />
          {diagram.base !== null && <Band band={diagram.base} id={`${baseId}-band-base`} className={styles.layersBase} />}
        </div>
        {diagram.asides.map((aside, index) => (
          <Band key={aside.line} band={aside} id={`${baseId}-band-aside-${String(index)}`} className={styles.layersAside} />
        ))}
      </div>
      {diagram.title !== null && <figcaption className={styles.diagramCaption}>{diagram.title}</figcaption>}
    </figure>
  );
}

import type { LayerBand, LayerNode, LayersDiagram } from './types';

function layerTexts(node: LayerNode): string[] {
  return [
    node.name,
    ...node.children.flatMap((child) => {
      if (child.kind === 'layer') return layerTexts(child);
      if (child.kind === 'group') return [child.name, ...child.items];
      return [...child.items];
    }),
  ];
}

function bandTexts(band: LayerBand): string[] {
  return [band.name, ...band.items];
}

export function layersTexts(diagram: LayersDiagram): readonly string[] {
  return [
    ...layerTexts(diagram.root),
    ...(diagram.base === null ? [] : bandTexts(diagram.base)),
    ...diagram.asides.flatMap(bandTexts),
  ];
}

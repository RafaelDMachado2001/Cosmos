import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { DIAGRAM_FONT_PX, labelWidth, nodeSize, textWidth } from './measure';

const CSS = readFileSync('src/components/ArticleBody/ArticleBody.module.css', 'utf8');

function cssFontSize(selector: string): number {
  const rule = new RegExp(`\\.${selector} \\{[^}]*font-size: ([0-9.]+)px;`).exec(CSS);
  return Number(rule?.[1]);
}

describe('medida dos rótulos', () => {
  it('a largura sai de caracteres × 0,6 × fonte, em pontos de código', () => {
    expect(textWidth('NGINX', 10)).toBe(30);
    expect(textWidth('·é', 10)).toBe(12);
  });

  it('tamanho do nó com e sem subtítulo', () => {
    expect(nodeSize({ id: 'a', label: 'NGINX', sub: 'servidor web', line: 1 })).toEqual({
      w: 12 * 0.6 * 11 + 30,
      h: 48,
    });
    expect(nodeSize({ id: 'a', label: 'NGINX', sub: null, line: 1 })).toEqual({ w: 5 * 0.6 * 13 + 30, h: 32 });
  });

  it('pílula é o texto mais 16', () => {
    expect(labelWidth('HTTPS')).toBe(5 * 0.6 * 11 + 16);
  });

  it('as constantes espelham as classes do CSS, senão o layout mede errado', () => {
    expect(DIAGRAM_FONT_PX).toEqual({
      nodeLabel: cssFontSize('diagramNodeLabel'),
      nodeSub: cssFontSize('diagramNodeSub'),
      edgeLabel: cssFontSize('diagramLabelText'),
    });
  });
});

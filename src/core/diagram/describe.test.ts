import { describe, expect, it } from 'vitest';

import { describeDiagram } from './describe';
import { REFERENCE_DIAGRAM } from './fixture';
import { parseDiagram } from './parse';
import type { FlowDiagram } from './types';

function diagram(source: string): FlowDiagram {
  const result = parseDiagram(source);
  if (!result.ok) throw new Error('fixture inválida');
  return result.diagram;
}

describe('describeDiagram', () => {
  it('descreve o exemplo de referência', () => {
    expect(describeDiagram(diagram(REFERENCE_DIAGRAM))).toBe(
      'Navegador para NGINX, via HTTPS. ' +
        'NGINX para public/, quando arquivo existe? ' +
        'NGINX para PHP-FPM, via FastCGI · unix socket. ' +
        'PHP-FPM para index.php, via executa.',
    );
  });

  it('aresta sem rótulo e nó isolado', () => {
    expect(describeDiagram(diagram('flow f\na "A"\nb "B"\nc "C"\na -> b'))).toBe('A para B. C, sem conexões.');
  });

  it('usa o vocabulário recebido', () => {
    const words = { to: 'to', via: 'via', when: 'when', isolated: 'not connected' };
    expect(describeDiagram(diagram('flow f\na "A"\nb "B"\na -> b : ok?'), words)).toBe('A to B, when ok?');
  });
});

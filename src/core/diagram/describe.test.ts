import { describe, expect, it } from 'vitest';

import { DIAGRAM_VOCABULARY_PT, describeDiagram } from './describe';
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
      'Navegador para NGINX: HTTPS. ' +
        'NGINX para public/, quando arquivo existe? ' +
        'NGINX para PHP-FPM: FastCGI · unix socket. ' +
        'PHP-FPM para index.php: executa.',
    );
  });

  it('aresta sem rótulo e nó isolado', () => {
    expect(describeDiagram(diagram('flow f\na "A"\nb "B"\nc "C"\na -> b'))).toBe('A para B. C, sem conexões.');
  });

  it('usa o vocabulário recebido', () => {
    const words = { ...DIAGRAM_VOCABULARY_PT, to: 'to', when: 'when', isolated: 'not connected' };
    expect(describeDiagram(diagram('flow f\na "A"\nb "B"\na -> b : ok?'), words)).toBe('A to B, when ok?');
  });

  it('descreve cada cenário depois do fluxo', () => {
    const source = 'flow f\na "A"\nb "B"\na -> b\nstate 502\ntitle: Falhou\ntext: Quebrou\nhint: olhe o log\na -> b broken\nb down';
    expect(describeDiagram(diagram(source))).toBe(
      'A para B. Cenário 502: Falhou. Quebrou. A para B com falha. B fora do ar. Dica: olhe o log.',
    );
  });

  it('cita o caminho do cenário', () => {
    expect(describeDiagram(diagram('flow f\na "A"\nb "B"\na -> b\nstate ok\npath a b'))).toBe(
      'A para B. Cenário ok. Caminho: A, B.',
    );
  });
});

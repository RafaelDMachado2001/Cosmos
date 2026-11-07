import { describe, expect, it } from 'vitest';

import { REFERENCE_SEQUENCE } from './fixture';
import { LABEL_HEIGHT } from './measure';
import { parseDiagram } from './parse';
import { layoutSequence } from './sequence';
import type { DiagramError, SequenceDiagram } from './types';

function sequence(source: string): SequenceDiagram {
  const result = parseDiagram(source);
  if (!result.ok || result.diagram.kind !== 'sequence') throw new Error(JSON.stringify(result));
  return result.diagram;
}

function errors(source: string): readonly DiagramError[] {
  const result = parseDiagram(source);
  if (result.ok) throw new Error('esperava erro');
  return result.errors;
}

const body = (...lines: readonly string[]): string => ['sequence s', ...lines].join('\n');
const PAIR = ['a "A"', 'b "B"'];
const LONG = 'rótulo bem comprido demais';

describe('parseDiagram: sequência', () => {
  it('lê participantes e mensagens, com a resposta marcada', () => {
    const diagram = sequence(REFERENCE_SEQUENCE);
    expect(diagram.participants.map((item) => item.id)).toEqual(['app', 'fila', 'worker']);
    expect(diagram.participants[1]).toMatchObject({ label: 'Fila', sub: 'Redis' });
    expect(diagram.messages[3]).toMatchObject({ from: 'worker', to: 'fila', label: 'confirma', reply: true });
    expect(diagram.messages[0]).toMatchObject({ reply: false });
  });

  it('mensagem sem texto e colada nas setas', () => {
    expect(sequence(body(...PAIR, 'a->b', 'b-->a')).messages.map((item) => [item.label, item.reply])).toEqual([
      [null, false],
      [null, true],
    ]);
  });

  it.each([
    ['um participante', ['a "A"', 'a -> a'], 'ao menos 2'],
    ['sem mensagens', PAIR, 'não tem mensagens'],
    ['seis participantes', [...['a', 'b', 'c', 'd', 'e', 'f'].map((id) => `${id} "${id}"`), 'a -> b'], 'mais de 5'],
    ['participante não declarado', [...PAIR, 'a -> c'], '"c" não foi declarado'],
    ['sugere o parecido', ['nginx "N"', 'php "P"', 'nginx -> phpp'], 'Você quis dizer "php"?'],
    ['resposta para si mesmo', [...PAIR, 'a --> a'], 'para ele mesmo'],
    ['diretiva errada', ['direction: down', ...PAIR, 'a -> b'], 'Use "title"'],
    ['mensagem longa', [...PAIR, `a -> b : ${'x'.repeat(29)}`], 'mensagem com 29'],
    ['id repetido', [...PAIR, 'a "A2"', 'a -> b'], 'repetido'],
  ])('%s', (_name, lines, message) => {
    expect(errors(body(...lines)).map((error) => error.message).join('\n')).toContain(message);
  });

  it('limita as mensagens', () => {
    const many = Array.from({ length: 21 }, () => 'a -> b');
    expect(errors(body(...PAIR, ...many))[0]?.message).toContain('mais de 20 mensagens');
  });
});

describe('layoutSequence', () => {
  const GRAPHS = {
    referência: REFERENCE_SEQUENCE,
    'rótulo longo': body(...PAIR, 'c "C"', `a -> b : ${LONG}`, `b -> c : ${LONG}`, `a -> c : ${LONG}`),
    'para si no último': body(...PAIR, `b -> b : ${LONG}`, 'a -> b'),
    'para si no primeiro': body(...PAIR, `a -> a : ${LONG}`, 'b --> a'),
    'cinco colunas': body(...['a', 'b', 'c', 'd', 'e'].map((id) => `${id} "${id}"`), `a -> e : ${LONG}`, 'e --> a', 'c -> c'),
  };

  describe.each(Object.entries(GRAPHS))('%s', (_name, source) => {
    const layout = layoutSequence(sequence(source));

    it('tudo cabe no viewBox', () => {
      for (const box of layout.participants) {
        expect(box.x - box.w / 2).toBeGreaterThanOrEqual(0);
        expect(box.x + box.w / 2).toBeLessThanOrEqual(layout.width);
      }
      for (const { label } of layout.messages) {
        if (label === null) continue;
        expect(label.x - label.w / 2).toBeGreaterThanOrEqual(0);
        expect(label.x + label.w / 2).toBeLessThanOrEqual(layout.width);
        expect(label.y + LABEL_HEIGHT / 2).toBeLessThanOrEqual(layout.height);
      }
    });

    it('nenhum participante sobre outro', () => {
      for (const [index, box] of layout.participants.slice(1).entries()) {
        const previous = layout.participants[index];
        expect(box.x - box.w / 2).toBeGreaterThan((previous?.x ?? 0) + (previous?.w ?? 0) / 2);
      }
    });

    it('nenhum rótulo sobre outro', () => {
      const labels = layout.messages.flatMap(({ label }) => (label === null ? [] : [label]));
      for (const [index, a] of labels.entries()) {
        for (const b of labels.slice(index + 1)) {
          const apart = Math.abs(a.y - b.y) >= LABEL_HEIGHT || Math.abs(a.x - b.x) >= (a.w + b.w) / 2;
          expect(apart).toBe(true);
        }
      }
    });

    it('as linhas de vida cobrem todas as mensagens', () => {
      const bottom = Math.max(...layout.messages.map((message) => Number(/,(\d+(?:\.\d+)?)$/.exec(message.d)?.[1] ?? 0)));
      for (const lifeline of layout.lifelines) expect(lifeline.bottom).toBeGreaterThan(bottom);
    });
  });

  it('a ordem das colunas é a da declaração', () => {
    const { participants } = layoutSequence(sequence(REFERENCE_SEQUENCE));
    expect(participants.map((box) => box.id)).toEqual(['app', 'fila', 'worker']);
  });

  it('a mensagem longa abre o vão entre as colunas', () => {
    const short = layoutSequence(sequence(body(...PAIR, 'a -> b : x')));
    const long = layoutSequence(sequence(body(...PAIR, `a -> b : ${LONG}`)));
    expect(long.width).toBeGreaterThan(short.width);
  });

  it('é determinístico', () => {
    const diagram = sequence(REFERENCE_SEQUENCE);
    expect(layoutSequence(diagram)).toEqual(layoutSequence(diagram));
  });
});

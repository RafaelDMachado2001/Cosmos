import { describe, expect, it } from 'vitest';

import { parseBlocks } from './blocks';
import { outline } from './outline';
import { parseSavedProgress, percentLabel, scrollProgress, shouldOfferResume } from './readingProgress';
import { readingMinutes } from './readingTime';

describe('outline', () => {
  it('um id por intertítulo, sem acento nem marcação, único no artigo', () => {
    const blocks = parseBlocks(['## Introdução', 'texto', '### O `código`', '## Introdução', '## !!!', '## Introdução'].join('\n\n'));
    expect(outline(blocks)).toEqual([
      { id: 'introducao', label: 'Introdução', level: 2 },
      { id: 'o-codigo', label: 'O código', level: 3 },
      { id: 'introducao-2', label: 'Introdução', level: 2 },
      { id: 'secao', label: '!!!', level: 2 },
      { id: 'introducao-3', label: 'Introdução', level: 2 },
    ]);
  });
});

describe('readingMinutes', () => {
  const words = (count: number): string => Array.from({ length: count }, () => 'palavra').join(' ');

  it('220 palavras por minuto, arredondando para cima, mínimo 1', () => {
    expect(readingMinutes(parseBlocks(''))).toBe(1);
    expect(readingMinutes(parseBlocks(words(220)))).toBe(1);
    expect(readingMinutes(parseBlocks(words(221)))).toBe(2);
  });

  it('conta todos os blocos de texto; código pesa duas palavras por linha', () => {
    const markdown = [
      `## ${words(10)}`,
      words(100),
      `> ${words(10)}`,
      `- ${words(50)}`,
      `> [!note] ${words(5)}\n> ${words(5)}`,
      `> [!flow]\n> - ${words(10)}\n> - ${words(10)}`,
      `| ${words(10)} |\n| --- |\n| ${words(10)} |`,
      // 10 linhas de código não vazias = 20 palavras
      ['```ts', ...Array.from({ length: 10 }, () => 'x'), '', '```'].join('\n'),
      '![uma imagem com alt longo](https://example.com/a.png)',
    ].join('\n\n');
    // 10+100+10+50+10+20+20+20 = 240 -> 2 minutos
    expect(readingMinutes(parseBlocks(markdown))).toBe(2);
  });
});

describe('progresso de leitura', () => {
  it('fração da rolagem, de 0 a 1', () => {
    expect(scrollProgress(0, 3000, 1000)).toBe(0);
    expect(scrollProgress(1000, 3000, 1000)).toBe(0.5);
    expect(scrollProgress(5000, 3000, 1000)).toBe(1);
    expect(scrollProgress(0, 800, 1000)).toBe(1);
  });

  it('oferece continuar só no meio do caminho', () => {
    expect(shouldOfferResume(null)).toBe(false);
    expect(shouldOfferResume(0.04)).toBe(false);
    expect(shouldOfferResume(0.3)).toBe(true);
    expect(shouldOfferResume(0.99)).toBe(false);
  });

  it('o que vem do armazenamento só vale se for uma fração', () => {
    expect(parseSavedProgress('0.42')).toBe(0.42);
    expect(parseSavedProgress(null)).toBeNull();
    expect(parseSavedProgress('abc')).toBeNull();
    expect(parseSavedProgress('2')).toBeNull();
    expect(percentLabel(0.426)).toBe('43%');
  });
});

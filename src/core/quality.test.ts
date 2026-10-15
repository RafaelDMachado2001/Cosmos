import { describe, expect, it } from 'vitest';

import { QUALITY_LEVELS, createQualityGovernor, effectiveLevel } from './quality';

/** Alimenta o governador com `seconds` de quadros de `frameMs` cada. */
function run(governor: ReturnType<typeof createQualityGovernor>, frameMs: number, seconds: number) {
  const frames = Math.ceil((seconds * 1000) / frameMs);
  for (let i = 0; i < frames; i += 1) governor.sample(frameMs);
}

describe('createQualityGovernor', () => {
  it('fica no nível cheio enquanto o quadro cabe em 20ms', () => {
    const governor = createQualityGovernor();
    run(governor, 16.7, 5);
    expect(governor.level).toBe(0);
  });

  it('desce para meia resolução depois de um segundo acima de 20ms', () => {
    const governor = createQualityGovernor();
    run(governor, 25, 1.1);
    expect(QUALITY_LEVELS[governor.level]).toEqual({ scale: 0.5, octaves: 5 });
  });

  it('se ainda pesar, corta as oitavas para 3, e para aí', () => {
    const governor = createQualityGovernor();
    run(governor, 30, 10);
    expect(QUALITY_LEVELS[governor.level]).toEqual({ scale: 0.5, octaves: 3 });
  });

  it('não volta a subir: oscilar entre níveis seria pior que ficar no leve', () => {
    const governor = createQualityGovernor();
    run(governor, 25, 1.1);
    run(governor, 8, 10);
    expect(governor.level).toBe(1);
  });

  it('um quadro isolado lento não derruba a qualidade', () => {
    const governor = createQualityGovernor();
    run(governor, 16, 0.5);
    governor.sample(45);
    run(governor, 16, 0.6);
    expect(governor.level).toBe(0);
  });
});

describe('effectiveLevel', () => {
  it('abaixo de 780px começa em meia resolução', () => {
    expect(QUALITY_LEVELS[effectiveLevel(0, 600)]?.scale).toBe(0.5);
    expect(effectiveLevel(0, 1280)).toBe(0);
    expect(effectiveLevel(2, 600)).toBe(2);
  });
});

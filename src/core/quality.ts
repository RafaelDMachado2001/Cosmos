/**
 * Qualidade adaptativa do céu de fundo.
 *
 * O fundo é uma passada de tela cheia com custo fixo por pixel, e as
 * nebulosas (três fbm) são a parte cara. Quando o quadro não cabe, o céu é
 * desenhado em meia resolução e ampliado; se ainda pesar, as fbm caem de 5
 * para 3 oitavas.
 *
 * Módulo puro: sem DOM, sem React, sem Three.
 */

export interface QualityLevel {
  /** Fração da resolução em que o céu é desenhado. */
  readonly scale: 1 | 0.5;
  readonly octaves: 5 | 3;
}

export const QUALITY_LEVELS: readonly QualityLevel[] = [
  { scale: 1, octaves: 5 },
  { scale: 0.5, octaves: 5 },
  { scale: 0.5, octaves: 3 },
];

export const QUALITY = {
  /** Média acima disto, numa janela, é GPU que não sustenta 50 fps. */
  slowFrameMs: 20,
  windowMs: 1000,
  /** Abaixo desta largura o céu já começa em meia resolução. */
  narrowWidth: 780,
} as const;

export interface QualityGovernor {
  readonly level: number;
  /** Registra um quadro. Devolve verdadeiro quando o nível mudou. */
  sample(frameMs: number): boolean;
}

/**
 * Mede o tempo médio de quadro em janelas de um segundo e desce um nível a
 * cada janela lenta. **Só desce**: uma GPU que não sustentou um segundo não
 * vai sustentar o seguinte, e alternar entre níveis piscaria a resolução.
 */
export function createQualityGovernor(): QualityGovernor {
  let level = 0;
  let total = 0;
  let count = 0;

  return {
    get level() {
      return level;
    },
    sample(frameMs: number): boolean {
      total += frameMs;
      count += 1;
      if (total < QUALITY.windowMs) return false;

      const average = total / count;
      total = 0;
      count = 0;
      if (average <= QUALITY.slowFrameMs || level >= QUALITY_LEVELS.length - 1) return false;
      level += 1;
      return true;
    },
  };
}

/** O nível do governador, com o piso de meia resolução em telas estreitas. */
export function effectiveLevel(governorLevel: number, viewportWidth: number): number {
  return Math.max(governorLevel, viewportWidth < QUALITY.narrowWidth ? 1 : 0);
}

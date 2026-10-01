/**
 * Movimento: os coeficientes de suavização e as constantes de interação.
 *
 * Este é o único lugar onde esses números vivem. O handoff chama a suavização
 * de "o ponto crítico do design": nada é aplicado direto, todo valor tem um par
 * bruto/suavizado interpolado a cada quadro.
 *
 * Módulo puro: sem DOM, sem React, sem Three.
 */

/** Coeficiente de interpolação por quadro, como especificado no handoff. */
export interface MotionProfile {
  readonly enter: number;
  readonly pan: number;
  readonly zoom: number;
  readonly readerFade: number;
  readonly mouse: number;
}

/**
 * A tabela do handoff, literal.
 *
 * Movimento reduzido acelera as interpolações em vez de remover funcionalidade:
 * o gesto continua existindo, só chega ao destino quase imediatamente.
 */
export const PER_FRAME_K: Record<'normal' | 'reduced', MotionProfile> = {
  normal: { enter: 0.055, pan: 0.062, zoom: 0.055, readerFade: 0.085, mouse: 0.05 },
  reduced: { enter: 0.16, pan: 0.3, zoom: 0.3, readerFade: 0.3, mouse: 0.05 },
};

/** Os coeficientes acima foram calibrados assumindo 60 quadros por segundo. */
export const REFERENCE_FPS = 60;

/**
 * Converte um coeficiente por quadro em um lambda de suavização exponencial.
 *
 * O protótipo fazia `s += (alvo - s) * k` cru, que depende do framerate: num
 * monitor de 144Hz a mesma cena chega ao destino bem mais rápido. `damp` com
 * este lambda produz exatamente o mesmo passo a 60fps e a mesma curva em
 * qualquer outra taxa.
 *
 *   1 - k = e^(-lambda / fps)  =>  lambda = -fps * ln(1 - k)
 */
export function lambdaFor(perFrameK: number): number {
  if (perFrameK <= 0) return 0;
  return -REFERENCE_FPS * Math.log(1 - perFrameK);
}

/** Perfil já convertido para lambdas, conforme a preferência de movimento. */
export function lambdas(reduced: boolean): MotionProfile {
  const k = reduced ? PER_FRAME_K.reduced : PER_FRAME_K.normal;
  return {
    enter: lambdaFor(k.enter),
    pan: lambdaFor(k.pan),
    zoom: lambdaFor(k.zoom),
    readerFade: lambdaFor(k.readerFade),
    mouse: lambdaFor(k.mouse),
  };
}

/** Inércia do arraste, conforme o handoff. */
export const INERTIA = {
  /** Ao soltar, a velocidade recebe este impulso. */
  releaseBoost: 1.2,
  decay: 0.955,
  /** Abaixo disto para de vez, em vez de arrastar indefinidamente. */
  stopBelow: 0.15,
} as const;

export function stepInertia(velocity: number): number {
  const next = velocity * INERTIA.decay;
  return Math.abs(next) < INERTIA.stopBelow ? 0 : next;
}

/** Acima disto o ponteiro arrastou, e o clique não abre a publicação. */
export const DRAG_CLICK_THRESHOLD_PX = 6;

/**
 * O gesto foi arraste, e não clique?
 *
 * `distancePx` é o caminho percorrido pelo ponteiro entre pressionar e soltar,
 * acumulado em valor absoluto — não o deslocamento líquido.
 *
 * O limiar existe porque um mouse real quase nunca solta no mesmo pixel em que
 * pressionou. Tratar qualquer movimento como arraste faria a constelação
 * engolir o clique e a publicação nunca abriria.
 */
export function isDrag(distancePx: number): boolean {
  return distancePx >= DRAG_CLICK_THRESHOLD_PX;
}

/** Espera entre avançar a câmera e montar a vista de leitura. */
export const OPEN_DELAY_MS = { normal: 760, reduced: 120 } as const;

/**
 * Teto do delta de quadro. Sem ele, voltar para uma aba que ficou minutos em
 * segundo plano produziria um salto enorme numa única interpolação.
 */
export const MAX_FRAME_DELTA_S = 0.05;

// ---------------------------------------------------------------------------
// Pulso de energia do núcleo
// ---------------------------------------------------------------------------

/** Decaimento do pulso por quadro, conforme o handoff. */
export const PULSE_DECAY_PER_FRAME = { normal: 0.965, reduced: 0.9 } as const;

/** Intervalo aleatório entre disparos, em segundos. */
export const PULSE_INTERVAL_S = { min: 1.4, max: 5 } as const;

/** O tempo do shader roda a 25% da velocidade com movimento reduzido. */
export const TIME_SCALE = { normal: 1, reduced: 0.25 } as const;

const PULSE_LAMBDA = {
  normal: -REFERENCE_FPS * Math.log(PULSE_DECAY_PER_FRAME.normal),
  reduced: -REFERENCE_FPS * Math.log(PULSE_DECAY_PER_FRAME.reduced),
} as const;

/**
 * Decaimento do pulso, independente de framerate — pelo mesmo motivo das
 * interpolações: a 144Hz o decaimento por quadro apagaria o pulso rápido
 * demais e a energia deixaria de se ler percorrendo a superfície.
 */
export function decayPulse(pulse: number, reduced: boolean, deltaSeconds: number): number {
  const lambda = reduced ? PULSE_LAMBDA.reduced : PULSE_LAMBDA.normal;
  return pulse * Math.exp(-lambda * deltaSeconds);
}

/** Próximo disparo, em segundos a partir de agora. */
export function nextPulseAt(now: number, random: () => number = Math.random): number {
  return now + PULSE_INTERVAL_S.min + random() * (PULSE_INTERVAL_S.max - PULSE_INTERVAL_S.min);
}

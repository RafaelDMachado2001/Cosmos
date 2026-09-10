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

/** Espera entre avançar a câmera e montar a vista de leitura. */
export const OPEN_DELAY_MS = { normal: 760, reduced: 120 } as const;

/**
 * Teto do delta de quadro. Sem ele, voltar para uma aba que ficou minutos em
 * segundo plano produziria um salto enorme numa única interpolação.
 */
export const MAX_FRAME_DELTA_S = 0.05;

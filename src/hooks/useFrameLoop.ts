import { useEffect, useRef } from 'react';

import { MAX_FRAME_DELTA_S } from '../core/motion';

/**
 * O único requestAnimationFrame da aplicação.
 *
 * Nas fases seguintes é este mesmo quadro que escreve os transforms do DOM da
 * constelação, além dos uniforms do shader. Um segundo laço sairia de fase com
 * este, e a suavização é o ponto mais sensível do design.
 *
 * O callback vive num ref: trocar a função a cada render não reinicia o laço.
 */
export function useFrameLoop(onFrame: (deltaSeconds: number) => void, active = true): void {
  const callbackRef = useRef(onFrame);
  callbackRef.current = onFrame;

  useEffect(() => {
    if (!active) return;

    let handle = 0;
    let previous = performance.now();
    let running = true;

    const tick = (now: number): void => {
      if (!running) return;
      // Teto no delta: voltar a uma aba que ficou minutos em segundo plano
      // produziria um salto enorme numa única interpolação.
      const delta = Math.min((now - previous) / 1000, MAX_FRAME_DELTA_S);
      previous = now;
      try {
        callbackRef.current(delta);
      } catch (error) {
        // Sem isto, uma excecao em QUALQUER ponto do quadro (3D, DOM, o que
        // for) cancelava o proprio requestAnimationFrame seguinte e travava
        // a aplicacao inteira pra sempre — enter, pan e fase, nao so o
        // visual. Aconteceu de fato: Chromium headless sem GPU no CI.
        console.error('quadro falhou; continuando no próximo em vez de travar', error);
      }
      handle = requestAnimationFrame(tick);
    };

    const onVisibility = (): void => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(handle);
        return;
      }
      if (running) return;
      running = true;
      // Recomeça a contagem: sem isto o primeiro quadro após voltar traria o
      // tempo inteiro em que a aba esteve escondida.
      previous = performance.now();
      handle = requestAnimationFrame(tick);
    };

    document.addEventListener('visibilitychange', onVisibility);
    handle = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(handle);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [active]);
}

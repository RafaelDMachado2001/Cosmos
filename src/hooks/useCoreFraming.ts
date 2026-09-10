import { useEffect } from 'react';
import type { RefObject } from 'react';

import { computeFraming } from '../three/framing';
import type { Framing } from '../three/framing';

/**
 * Mede o enquadramento do núcleo e reavisa sempre que a medida puder ter
 * mudado.
 *
 * As cinco fontes de re-medição não são zelo excessivo — o protótipo teve dois
 * bugs sérios aqui. `window.innerWidth/Height` podem ser 0 no primeiro mount,
 * e o `ResizeObserver` precisa observar o container fixo raiz, porque
 * `document.documentElement` tem altura 0 num layout todo `position: fixed`.
 *
 * Quando a medida não é confiável, `computeFraming` devolve `null` e a cena
 * simplesmente mantém a anterior, em vez de gravar um NaN permanente.
 */
export function useCoreFraming(
  rootRef: RefObject<HTMLElement>,
  headerRef: RefObject<HTMLElement>,
  textBlockRef: RefObject<HTMLElement>,
  onFraming: (framing: Framing | null) => void,
): void {
  useEffect(() => {
    let alive = true;

    const measure = (): void => {
      if (!alive) return;

      const width = window.innerWidth || document.documentElement.clientWidth;
      const height = window.innerHeight || document.documentElement.clientHeight;
      const header = headerRef.current;
      const textBlock = textBlockRef.current;
      if (!header || !textBlock) {
        onFraming(null);
        return;
      }

      onFraming(
        computeFraming({
          viewportWidth: width,
          viewportHeight: height,
          headerHeightPx: header.offsetHeight,
          // Medir a posição real, nunca uma constante.
          textBlockTopPx: textBlock.getBoundingClientRect().top,
        }),
      );
    };

    // 1. Redimensionamento da janela.
    window.addEventListener('resize', measure);

    // 2. O container fixo raiz. documentElement tem altura 0 aqui.
    const observer =
      'ResizeObserver' in window && rootRef.current ? new ResizeObserver(measure) : null;
    if (observer && rootRef.current) observer.observe(rootRef.current);

    // 3. Barra de endereço do mobile entrando e saindo.
    window.visualViewport?.addEventListener('resize', measure);

    // 4. Carga completa da página.
    window.addEventListener('load', measure);

    // 5. Fontes prontas: o bloco de texto muda de altura quando a Roboto entra.
    document.fonts?.ready.then(measure).catch(() => {
      /* sem a API de fontes os timers abaixo cobrem o caso */
    });

    // Rede de segurança para o primeiro mount, quando as medidas podem vir 0.
    const timers = [0, 60, 160, 400, 1000].map((ms) => window.setTimeout(measure, ms));
    const firstFrame = requestAnimationFrame(measure);

    measure();

    return () => {
      alive = false;
      window.removeEventListener('resize', measure);
      window.removeEventListener('load', measure);
      window.visualViewport?.removeEventListener('resize', measure);
      observer?.disconnect();
      for (const timer of timers) window.clearTimeout(timer);
      cancelAnimationFrame(firstFrame);
    };
  }, [rootRef, headerRef, textBlockRef, onFraming]);
}

import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

export interface MeasuredViewport {
  readonly width: number;
  readonly height: number;
  readonly headerPx: number;
}

/**
 * Dimensões da janela e altura real do header.
 *
 * Diferente de `useCoreFraming`, aqui a medida VIRA estado: a banda vertical
 * das estrelas muda o layout, então o React precisa re-renderizar. Muda em
 * resize, não por quadro.
 */
export function useViewport(headerRef: RefObject<HTMLElement>): MeasuredViewport {
  const [viewport, setViewport] = useState<MeasuredViewport>(() => ({
    width: typeof window === 'undefined' ? 1280 : window.innerWidth,
    height: typeof window === 'undefined' ? 800 : window.innerHeight,
    headerPx: 76,
  }));

  useEffect(() => {
    const measure = (): void => {
      const width = window.innerWidth || document.documentElement.clientWidth;
      const height = window.innerHeight || document.documentElement.clientHeight;
      if (!width || !height) return;

      const headerPx = headerRef.current?.offsetHeight ?? 76;
      setViewport((current) =>
        current.width === width && current.height === height && current.headerPx === headerPx
          ? current
          : { width, height, headerPx },
      );
    };

    window.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('resize', measure);
    const timer = window.setTimeout(measure, 0);
    measure();

    return () => {
      window.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('resize', measure);
      window.clearTimeout(timer);
    };
  }, [headerRef]);

  return viewport;
}

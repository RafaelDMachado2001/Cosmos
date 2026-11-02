import { useEffect } from 'react';
import type { RefObject } from 'react';

import { computeFraming } from '../three/framing';
import type { Framing } from '../three/framing';

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
          textBlockTopPx: textBlock.getBoundingClientRect().top,
        }),
      );
    };

    window.addEventListener('resize', measure);

    const observer =
      'ResizeObserver' in window && rootRef.current ? new ResizeObserver(measure) : null;
    if (observer && rootRef.current) observer.observe(rootRef.current);

    window.visualViewport?.addEventListener('resize', measure);

    window.addEventListener('load', measure);

    document.fonts?.ready.then(measure).catch(() => {
    });

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

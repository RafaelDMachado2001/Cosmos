import { useEffect, useRef } from 'react';

import { MAX_FRAME_DELTA_S } from '../core/motion';

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
      const delta = Math.min((now - previous) / 1000, MAX_FRAME_DELTA_S);
      previous = now;
      try {
        callbackRef.current(delta);
      } catch (error) {
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

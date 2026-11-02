import { Suspense, lazy, useEffect, useState } from 'react';
import type { MutableRefObject, RefObject } from 'react';

import styles from './Backdrop.module.css';
import type { CoreScene } from '../../three/CoreScene';
import { isWebGLAvailable } from '../../three/webgl';

const CoreCanvas = lazy(() => import('../CoreCanvas/CoreCanvas'));

const IDLE_TIMEOUT_MS = 1500;

export interface BackdropProps {
  readonly rootRef: RefObject<HTMLElement>;
  readonly headerRef: RefObject<HTMLElement>;
  readonly textBlockRef: RefObject<HTMLElement>;
  readonly reducedMotion: boolean;
  readonly sceneRef: MutableRefObject<CoreScene | null>;
  readonly fallbackRef: RefObject<HTMLDivElement>;
  readonly skyFallbackRef: RefObject<HTMLDivElement>;
}

export function Backdrop({ fallbackRef, skyFallbackRef, ...props }: BackdropProps) {
  const [webgl, setWebgl] = useState<boolean | null>(null);

  useEffect(() => {
    const start = (): void => {
      setWebgl(isWebGLAvailable());
    };
    if (typeof window.requestIdleCallback === 'function') {
      const handle = window.requestIdleCallback(start, { timeout: IDLE_TIMEOUT_MS });
      return () => {
        window.cancelIdleCallback(handle);
      };
    }
    const timer = window.setTimeout(start, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <div className={styles.backdrop} aria-hidden="true">
      <div ref={fallbackRef} className={styles.fallback} />
      {webgl === false && <div ref={skyFallbackRef} className={styles.skyFallback} />}
      {webgl === true && (
        <Suspense fallback={null}>
          <CoreCanvas {...props} />
        </Suspense>
      )}
    </div>
  );
}

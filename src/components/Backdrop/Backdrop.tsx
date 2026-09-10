import { Suspense, lazy, useEffect, useState } from 'react';
import type { MutableRefObject, RefObject } from 'react';

import styles from './Backdrop.module.css';
import type { CoreScene } from '../../three/CoreScene';
import { isWebGLAvailable } from '../../three/webgl';

// three só entra no bundle se houver contexto para usá-lo.
const CoreCanvas = lazy(() => import('../CoreCanvas/CoreCanvas'));

export interface BackdropProps {
  readonly rootRef: RefObject<HTMLElement>;
  readonly headerRef: RefObject<HTMLElement>;
  readonly textBlockRef: RefObject<HTMLElement>;
  readonly reducedMotion: boolean;
  readonly sceneRef: MutableRefObject<CoreScene | null>;
  /** O laço apaga o fallback junto com o núcleo, na travessia. */
  readonly fallbackRef: RefObject<HTMLDivElement>;
}

export function Backdrop({ fallbackRef, ...props }: BackdropProps) {
  const [webgl, setWebgl] = useState<boolean | null>(null);

  useEffect(() => {
    setWebgl(isWebGLAvailable());
  }, []);

  return (
    <div className={styles.backdrop} aria-hidden="true">
      {/* Fallback estático: é o que aparece sem WebGL e enquanto a cena carrega. */}
      <div ref={fallbackRef} className={styles.fallback} />
      {webgl === true && (
        <Suspense fallback={null}>
          <CoreCanvas {...props} />
        </Suspense>
      )}
    </div>
  );
}

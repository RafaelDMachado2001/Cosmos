import { Suspense, lazy, useEffect, useState } from 'react';
import type { RefObject } from 'react';

import styles from './Backdrop.module.css';
import { isWebGLAvailable } from '../../three/webgl';

// three só entra no bundle se houver contexto para usá-lo.
const CoreCanvas = lazy(() => import('../CoreCanvas/CoreCanvas'));

export interface BackdropProps {
  readonly rootRef: RefObject<HTMLElement>;
  readonly headerRef: RefObject<HTMLElement>;
  readonly textBlockRef: RefObject<HTMLElement>;
  readonly reducedMotion: boolean;
}

export function Backdrop(props: BackdropProps) {
  const [webgl, setWebgl] = useState<boolean | null>(null);

  useEffect(() => {
    setWebgl(isWebGLAvailable());
  }, []);

  return (
    <div className={styles.backdrop} aria-hidden="true">
      {/* Fallback estático: é o que aparece sem WebGL e enquanto a cena carrega. */}
      <div className={styles.fallback} />
      {webgl === true && (
        <Suspense fallback={null}>
          <CoreCanvas {...props} />
        </Suspense>
      )}
    </div>
  );
}

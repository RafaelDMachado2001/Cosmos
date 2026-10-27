import { Suspense, lazy, useEffect, useState } from 'react';
import type { MutableRefObject, RefObject } from 'react';

import styles from './Backdrop.module.css';
import type { CoreScene } from '../../three/CoreScene';
import { isWebGLAvailable } from '../../three/webgl';

// three só entra no bundle se houver contexto para usá-lo.
const CoreCanvas = lazy(() => import('../CoreCanvas/CoreCanvas'));

/** O máximo que a cena espera por um momento ocioso. */
const IDLE_TIMEOUT_MS = 1500;

export interface BackdropProps {
  readonly rootRef: RefObject<HTMLElement>;
  readonly headerRef: RefObject<HTMLElement>;
  readonly textBlockRef: RefObject<HTMLElement>;
  readonly reducedMotion: boolean;
  readonly sceneRef: MutableRefObject<CoreScene | null>;
  /** O laço apaga o fallback junto com o núcleo, na travessia. */
  readonly fallbackRef: RefObject<HTMLDivElement>;
  /** Céu estático sem WebGL; o laço o acende junto com a revelação do cosmos. */
  readonly skyFallbackRef: RefObject<HTMLDivElement>;
}

export function Backdrop({ fallbackRef, skyFallbackRef, ...props }: BackdropProps) {
  const [webgl, setWebgl] = useState<boolean | null>(null);

  /*
   * A cena (e com ela o three, ~460 KB) só começa a carregar quando o
   * navegador fica ocioso, com teto de 1,5s: baixar e interpretar o chunk na
   * mesma janela da montagem disputava a thread com o primeiro input no
   * celular. Até lá fica o fallback em CSS, que já cobre o carregamento.
   */
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
      {/* Fallback estático: é o que aparece sem WebGL e enquanto a cena carrega. */}
      <div ref={fallbackRef} className={styles.fallback} />
      {/* Sem WebGL não há céu procedural: um gradiente parado no lugar dele. Os
          anos gigantes são DOM e continuam de pé. */}
      {webgl === false && <div ref={skyFallbackRef} className={styles.skyFallback} />}
      {webgl === true && (
        <Suspense fallback={null}>
          <CoreCanvas {...props} />
        </Suspense>
      )}
    </div>
  );
}

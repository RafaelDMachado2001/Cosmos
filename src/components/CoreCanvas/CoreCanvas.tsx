import { useCallback, useEffect, useRef } from 'react';
import type { MutableRefObject, RefObject } from 'react';

import styles from './CoreCanvas.module.css';
import { useCoreFraming } from '../../hooks/useCoreFraming';
import { CoreScene } from '../../three/CoreScene';
import type { Framing } from '../../three/framing';

export interface CoreCanvasProps {
  readonly rootRef: RefObject<HTMLElement>;
  readonly headerRef: RefObject<HTMLElement>;
  readonly textBlockRef: RefObject<HTMLElement>;
  readonly reducedMotion: boolean;
  /** Onde registrar a cena para o orquestrador de quadro encontrá-la. */
  readonly sceneRef: MutableRefObject<CoreScene | null>;
}

/**
 * Ponte entre o React e a cena: monta o canvas, cria a cena e a registra.
 *
 * Não roda laço próprio nem escuta o ponteiro — quem faz as duas coisas é o
 * useCosmosEngine, no mesmo quadro em que move a constelação.
 */
export default function CoreCanvas({
  rootRef,
  headerRef,
  textBlockRef,
  reducedMotion,
  sceneRef,
}: CoreCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let scene: CoreScene;
    try {
      scene = new CoreScene({ canvas, reducedMotion });
    } catch {
      // Contexto WebGL recusado: o gradiente do Backdrop assume o lugar.
      return;
    }
    sceneRef.current = scene;
    scene.resize(window.innerWidth, window.innerHeight);

    return () => {
      sceneRef.current = null;
      scene.dispose();
    };
    // reducedMotion não recria a cena; é propagado no efeito abaixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneRef]);

  useEffect(() => {
    sceneRef.current?.setReducedMotion(reducedMotion);
  }, [reducedMotion, sceneRef]);

  const onFraming = useCallback(
    (framing: Framing | null) => {
      sceneRef.current?.setFraming(framing);
      if (framing) sceneRef.current?.resize(window.innerWidth, window.innerHeight);
    },
    [sceneRef],
  );

  useCoreFraming(rootRef, headerRef, textBlockRef, onFraming);

  return <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />;
}

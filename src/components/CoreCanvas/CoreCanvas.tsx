import { useCallback, useEffect, useRef } from 'react';
import type { RefObject } from 'react';

import styles from './CoreCanvas.module.css';
import { PER_FRAME_K, lambdaFor } from '../../core/motion';
import { useCoreFraming } from '../../hooks/useCoreFraming';
import { useFrameLoop } from '../../hooks/useFrameLoop';
import { CoreScene } from '../../three/CoreScene';
import type { Framing } from '../../three/framing';
import { damp } from '../../utils/damp';

export interface CoreCanvasProps {
  readonly rootRef: RefObject<HTMLElement>;
  readonly headerRef: RefObject<HTMLElement>;
  readonly textBlockRef: RefObject<HTMLElement>;
  readonly reducedMotion: boolean;
}

/**
 * Ponte entre o React e a cena.
 *
 * O componente monta e desmonta o canvas; tudo que muda por quadro — ponteiro,
 * enquadramento, uniforms — passa por refs e pelo laço, nunca por estado.
 */
export default function CoreCanvas({
  rootRef,
  headerRef,
  textBlockRef,
  reducedMotion,
}: CoreCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<CoreScene | null>(null);

  // Alvo bruto do ponteiro e valor suavizado, ambos fora do React.
  const pointer = useRef({ x: 0, y: 0, smoothX: 0, smoothY: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let scene: CoreScene;
    try {
      scene = new CoreScene({ canvas, reducedMotion });
    } catch {
      // Contexto WebGL recusado: o fundo em gradiente do Backdrop assume.
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
  }, []);

  useEffect(() => {
    sceneRef.current?.setReducedMotion(reducedMotion);
  }, [reducedMotion]);

  const onFraming = useCallback((framing: Framing | null) => {
    sceneRef.current?.setFraming(framing);
    if (framing) sceneRef.current?.resize(window.innerWidth, window.innerHeight);
  }, []);

  useCoreFraming(rootRef, headerRef, textBlockRef, onFraming);

  useEffect(() => {
    // Ponteiro fino só: em toque, a reação vem do próprio arraste.
    if (!window.matchMedia('(pointer: fine)').matches) return;

    const onMove = (event: PointerEvent): void => {
      pointer.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = -((event.clientY / window.innerHeight) * 2 - 1);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
    };
  }, []);

  const mouseLambda = lambdaFor(PER_FRAME_K.normal.mouse);

  useFrameLoop(
    useCallback(
      (delta: number) => {
        const scene = sceneRef.current;
        if (!scene) return;

        const state = pointer.current;
        state.smoothX = damp(state.smoothX, state.x, mouseLambda, delta);
        state.smoothY = damp(state.smoothY, state.y, mouseLambda, delta);
        scene.setPointer(state.smoothX, state.smoothY);

        scene.render(delta);
      },
      [mouseLambda],
    ),
  );

  return <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />;
}

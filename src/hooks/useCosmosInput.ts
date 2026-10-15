import { useCallback, useEffect } from 'react';
import type { MutableRefObject, RefObject } from 'react';

import { INERTIA } from '../core/motion';
import {
  COSMOS_PHASE_ENTER,
  INPUT,
  dominantAxisDelta,
  keyToDelta,
  push,
  scrubToPan,
} from '../core/navigation';
import type { PanBounds } from '../core/geometry';
import { suppressMouseSelection } from '../utils/selection';

/** O que a entrada escreve no estado contínuo do motor. */
export interface InputState {
  enter: number;
  pan: number;
  enterS: number;
  panS: number;
  mouseX: number;
  mouseY: number;
  velocity: number;
  dragging: false | 'pan' | 'scrub';
  dragX: number;
  dragMoved: number;
}

export interface CosmosInputOptions {
  readonly state: MutableRefObject<InputState>;
  readonly boundsRef: MutableRefObject<PanBounds>;
  /** Verdadeiro enquanto a vista de leitura está em cena. */
  readonly locked: () => boolean;
  readonly goHome: () => void;
  readonly cosmos: RefObject<HTMLElement>;
  readonly rail: RefObject<HTMLElement>;
}

export interface CosmosInput {
  onCosmosPointerDown: (event: React.PointerEvent) => void;
  onRailPointerDown: (event: React.PointerEvent) => void;
}

/**
 * Roda, teclado, ponteiro e toque, traduzidos em alvos de `enter` e `pan`.
 *
 * Só escreve alvos e velocidade; quem os suaviza e leva à tela é o laço do
 * motor. Tudo lido aqui vem de refs, porque os ouvintes vivem fora do React.
 */
export function useCosmosInput({
  state,
  boundsRef,
  locked,
  goHome,
  cosmos,
  rail,
}: CosmosInputOptions): CosmosInput {
  const applyPush = useCallback(
    (delta: number) => {
      const next = push(state.current, delta, boundsRef.current);
      state.current.enter = next.enter;
      state.current.pan = next.pan;
    },
    [state, boundsRef],
  );

  useEffect(() => {
    /*
     * Com a vista de leitura em cena a constelação não recebe mais nada.
     *
     * Vale já durante a abertura, quando a câmera ainda viaja: rolar ali
     * deslocaria o pan que o fechamento promete devolver. E é o que devolve a
     * roda ao artigo — sem esta saída antecipada o `preventDefault` abaixo
     * impediria o texto de rolar.
     */
    const onWheel = (event: WheelEvent): void => {
      if (locked()) return;
      event.preventDefault();
      applyPush(event.deltaY * INPUT.wheelGain);
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      if (locked()) return;
      const action = keyToDelta(event.key);
      if (!action) return;
      event.preventDefault();
      if (action.kind === 'home') {
        goHome();
        return;
      }
      if (action.kind === 'end') {
        state.current.enter = 1;
        state.current.pan = boundsRef.current.max;
        return;
      }
      applyPush(action.value);
    };

    const onPointerMove = (event: PointerEvent): void => {
      state.current.mouseX = (event.clientX / window.innerWidth) * 2 - 1;
      state.current.mouseY = -((event.clientY / window.innerHeight) * 2 - 1);

      const dragging = state.current.dragging;
      if (!dragging) return;

      if (dragging === 'scrub') {
        const rect = rail.current?.getBoundingClientRect();
        if (rect) {
          state.current.pan = scrubToPan(event.clientX, rect, boundsRef.current);
        }
        return;
      }

      const dx = state.current.dragX - event.clientX;
      state.current.dragX = event.clientX;
      state.current.dragMoved += Math.abs(dx);
      state.current.velocity = dx * INPUT.inertiaGain;
      state.current.pan = Math.min(
        boundsRef.current.max,
        Math.max(boundsRef.current.min, state.current.pan + dx * INPUT.dragGain),
      );
      // O arraste é direto: suavizar aqui faria a constelação escorregar
      // atrás do dedo.
      state.current.panS = state.current.pan;
    };

    const onPointerUp = (): void => {
      const dragging = state.current.dragging;
      if (!dragging) return;
      state.current.dragging = false;
      state.current.velocity =
        dragging === 'scrub' ? 0 : state.current.velocity * INERTIA.releaseBoost;
      if (cosmos.current) cosmos.current.style.cursor = 'grab';
      // Zera depois do ciclo de clique, para o clique saber que houve arraste.
      window.setTimeout(() => {
        state.current.dragMoved = 0;
      }, 60);
    };

    let touchX = 0;
    let touchY = 0;
    const onTouchStart = (event: TouchEvent): void => {
      const touch = event.touches[0];
      if (!touch) return;
      touchX = touch.clientX;
      touchY = touch.clientY;
    };
    const onTouchMove = (event: TouchEvent): void => {
      if (locked()) return;
      const touch = event.touches[0];
      if (!touch) return;
      const dx = touchX - touch.clientX;
      const dy = touchY - touch.clientY;
      touchX = touch.clientX;
      touchY = touch.clientY;
      applyPush(dominantAxisDelta(dx, dy) * INPUT.touchGain);
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });

    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
    };
  }, [applyPush, goHome, locked, state, boundsRef, cosmos, rail]);

  const onCosmosPointerDown = useCallback(
    (event: React.PointerEvent) => {
      suppressMouseSelection(event);
      if (locked()) return;
      if (state.current.enterS < COSMOS_PHASE_ENTER) return;
      state.current.dragging = 'pan';
      state.current.dragX = event.clientX;
      state.current.dragMoved = 0;
      state.current.velocity = 0;
      if (cosmos.current) cosmos.current.style.cursor = 'grabbing';
    },
    [locked, state, cosmos],
  );

  const onRailPointerDown = useCallback(
    (event: React.PointerEvent) => {
      suppressMouseSelection(event);
      if (locked()) return;
      state.current.dragging = 'scrub';
      state.current.dragMoved = 0;
      state.current.velocity = 0;
      const rect = rail.current?.getBoundingClientRect();
      if (rect) state.current.pan = scrubToPan(event.clientX, rect, boundsRef.current);
    },
    [locked, state, boundsRef, rail],
  );

  return { onCosmosPointerDown, onRailPointerDown };
}

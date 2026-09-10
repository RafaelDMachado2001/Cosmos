import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject, RefObject } from 'react';

import { INERTIA, PER_FRAME_K, lambdaFor, stepInertia } from '../core/motion';
import {
  COSMOS_PHASE_ENTER,
  INPUT,
  coreOpacity,
  cosmosReveal,
  dominantAxisDelta,
  heroFade,
  keyToDelta,
  panToScrubFraction,
  phaseFor,
  push,
  scrubToPan,
} from '../core/navigation';
import type { Phase } from '../core/navigation';
import { panBounds, panBucket, panForStar } from '../core/timeline';
import type { PlacedStar } from '../core/timeline';
import type { CoreScene } from '../three/CoreScene';
import { damp } from '../utils/damp';
import { useFrameLoop } from './useFrameLoop';

/** Margem de virtualização, em múltiplos da largura da viewport. */
const VIRTUAL_MARGIN_FACTOR = 1.5;

/** O pan avança tanto antes de a janela de virtualização precisar mudar. */
const PAN_BUCKET_PX = 512;

export interface CosmosRefs {
  readonly hero: RefObject<HTMLElement>;
  readonly cosmos: RefObject<HTMLElement>;
  readonly layer: RefObject<HTMLElement>;
  readonly scrub: RefObject<HTMLElement>;
  readonly marker: RefObject<HTMLElement>;
  readonly rail: RefObject<HTMLElement>;
  /** Fallback em CSS do núcleo, quando não há WebGL. */
  readonly fallback: RefObject<HTMLElement>;
}

export interface CosmosEngine {
  /** O CoreCanvas registra a cena aqui; o laço a consome. */
  readonly sceneRef: MutableRefObject<CoreScene | null>;
  readonly phase: Phase;
  /** Muda uma vez a cada PAN_BUCKET_PX; é o gatilho da virtualização. */
  readonly panBucket: number;
  readonly viewportWidth: number;
  readonly marginPx: number;
  readonly panRef: MutableRefObject<number>;
  goHome: () => void;
  goCosmos: () => void;
  focusStar: (star: PlacedStar) => void;
  /** Verdadeiro se o ponteiro arrastou o bastante para o clique não valer. */
  didDrag: () => boolean;
  onCosmosPointerDown: (event: React.PointerEvent) => void;
  onRailPointerDown: (event: React.PointerEvent) => void;
}

/** Estado contínuo. Mutável de propósito: é escrito a cada quadro, fora do React. */
interface MutableState {
  enter: number;
  pan: number;
  enterS: number;
  panS: number;
  mouseX: number;
  mouseY: number;
  mouseXS: number;
  mouseYS: number;
  velocity: number;
  dragging: false | 'pan' | 'scrub';
  dragX: number;
  dragMoved: number;
}

/**
 * O orquestrador. Mantém todo o estado contínuo em refs e o aplica num único
 * requestAnimationFrame que escreve tanto os uniforms do shader quanto os
 * transforms do DOM.
 *
 * Nada aqui passa por estado do React por quadro — só a fase e o bucket de
 * virtualização, que mudam raramente.
 */
export function useCosmosEngine(
  stars: readonly PlacedStar[],
  refs: CosmosRefs,
  reducedMotion: boolean,
): CosmosEngine {
  const sceneRef = useRef<CoreScene | null>(null);
  const state = useRef<MutableState>({
    enter: 0,
    pan: 0,
    enterS: 0,
    panS: 0,
    mouseX: 0,
    mouseY: 0,
    mouseXS: 0,
    mouseYS: 0,
    velocity: 0,
    dragging: false,
    dragX: 0,
    dragMoved: 0,
  });

  const [phase, setPhase] = useState<Phase>('hero');
  const [bucket, setBucket] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === 'undefined' ? 1280 : window.innerWidth,
  );

  const bounds = useMemo(
    () => panBounds(stars, viewportWidth),
    [stars, viewportWidth],
  );
  const boundsRef = useRef(bounds);
  boundsRef.current = bounds;

  const lambda = useMemo(
    () => ({
      enter: lambdaFor(reducedMotion ? PER_FRAME_K.reduced.enter : PER_FRAME_K.normal.enter),
      pan: lambdaFor(reducedMotion ? PER_FRAME_K.reduced.pan : PER_FRAME_K.normal.pan),
      mouse: lambdaFor(PER_FRAME_K.normal.mouse),
    }),
    [reducedMotion],
  );

  // -- Entradas -------------------------------------------------------------

  const applyPush = useCallback((delta: number) => {
    const next = push(state.current, delta, boundsRef.current);
    state.current.enter = next.enter;
    state.current.pan = next.pan;
  }, []);

  const goHome = useCallback(() => {
    state.current.enter = 0;
    state.current.pan = boundsRef.current.min;
    state.current.velocity = 0;
  }, []);

  const goCosmos = useCallback(() => {
    state.current.enter = 1;
  }, []);

  const focusStar = useCallback((star: PlacedStar) => {
    state.current.enter = 1;
    state.current.velocity = 0;
    state.current.pan = panForStar(stars, star, window.innerWidth);
  }, [stars]);

  const didDrag = useCallback(() => state.current.dragMoved > 0, []);

  useEffect(() => {
    const onResize = (): void => {
      setViewportWidth(window.innerWidth);
      sceneRef.current?.resize(window.innerWidth, window.innerHeight);
    };

    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      applyPush(event.deltaY * INPUT.wheelGain);
    };

    const onKeyDown = (event: KeyboardEvent): void => {
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
        const rect = refs.rail.current?.getBoundingClientRect();
        if (rect) {
          state.current.pan = scrubToPan(event.clientX, rect, boundsRef.current);
        }
        return;
      }

      const dx = state.current.dragX - event.clientX;
      state.current.dragX = event.clientX;
      state.current.dragMoved += Math.abs(dx);
      state.current.velocity = dx * INPUT.panGain;
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
      if (refs.cosmos.current) refs.cosmos.current.style.cursor = 'grab';
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
      const touch = event.touches[0];
      if (!touch) return;
      const dx = touchX - touch.clientX;
      const dy = touchY - touch.clientY;
      touchX = touch.clientX;
      touchY = touch.clientY;
      applyPush(dominantAxisDelta(dx, dy) * INPUT.touchGain);
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
    };
  }, [applyPush, goHome, refs.cosmos, refs.rail]);

  const onCosmosPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (state.current.enterS < COSMOS_PHASE_ENTER) return;
      state.current.dragging = 'pan';
      state.current.dragX = event.clientX;
      state.current.dragMoved = 0;
      state.current.velocity = 0;
      if (refs.cosmos.current) refs.cosmos.current.style.cursor = 'grabbing';
    },
    [refs.cosmos],
  );

  const onRailPointerDown = useCallback(
    (event: React.PointerEvent) => {
      state.current.dragging = 'scrub';
      state.current.dragMoved = 0;
      state.current.velocity = 0;
      const rect = refs.rail.current?.getBoundingClientRect();
      if (rect) state.current.pan = scrubToPan(event.clientX, rect, boundsRef.current);
    },
    [refs.rail],
  );

  // -- O quadro -------------------------------------------------------------

  const panRef = useRef(0);

  useFrameLoop(
    useCallback(
      (delta: number) => {
        const s = state.current;

        // Inércia do arraste, antes da suavização.
        if (!s.dragging && s.velocity !== 0) {
          s.pan = Math.min(
            boundsRef.current.max,
            Math.max(boundsRef.current.min, s.pan + s.velocity),
          );
          s.panS = s.pan;
          s.velocity = stepInertia(s.velocity);
        }

        s.enterS = damp(s.enterS, s.enter, lambda.enter, delta);
        s.panS = damp(s.panS, s.pan, lambda.pan, delta);
        s.mouseXS = damp(s.mouseXS, s.mouseX, lambda.mouse, delta);
        s.mouseYS = damp(s.mouseYS, s.mouseY, lambda.mouse, delta);

        panRef.current = s.panS;

        const enter = s.enterS;
        const fade = heroFade(enter);
        const reveal = cosmosReveal(enter);

        const hero = refs.hero.current;
        if (hero) {
          hero.style.opacity = String(1 - fade);
          hero.style.transform = `scale(${1 + enter * 0.5})`;
          hero.style.filter = `blur(${fade * 8}px)`;
          hero.style.pointerEvents = fade > 0.4 ? 'none' : 'auto';
        }

        const cosmos = refs.cosmos.current;
        if (cosmos) {
          cosmos.style.opacity = String(reveal);
          cosmos.style.transform = `scale(${0.94 + reveal * 0.06})`;
          cosmos.style.pointerEvents = reveal > 0.9 ? 'auto' : 'none';
        }

        const layer = refs.layer.current;
        if (layer) {
          const parallax = s.mouseXS * 10;
          layer.style.transform = `translate3d(${-s.panS + parallax}px, ${s.mouseYS * -6}px, 0)`;
        }

        const scrub = refs.scrub.current;
        if (scrub) scrub.style.opacity = String(reveal * 0.95);
        const marker = refs.marker.current;
        if (marker) {
          marker.style.left = `${panToScrubFraction(s.panS, boundsRef.current) * 100}%`;
        }

        // O núcleo não existe durante a exploração do cosmos: é a porta de
        // entrada e só reaparece no retorno. O canvas apaga pelo uOpacity do
        // shader; o fallback em CSS precisa apagar aqui.
        const fallback = refs.fallback.current;
        if (fallback) fallback.style.opacity = String(coreOpacity(enter));

        const scene = sceneRef.current;
        if (scene) {
          scene.setEnter(enter);
          scene.setPointer(s.mouseXS, s.mouseYS);
          scene.render(delta);
        }

        const nextPhase = phaseFor(enter);
        setPhase((current) => (current === nextPhase ? current : nextPhase));

        const nextBucket = panBucket(s.panS, PAN_BUCKET_PX);
        setBucket((current) => (current === nextBucket ? current : nextBucket));
      },
      [lambda, refs.cosmos, refs.fallback, refs.hero, refs.layer, refs.marker, refs.scrub],
    ),
  );

  return {
    sceneRef,
    phase,
    panBucket: bucket,
    viewportWidth,
    marginPx: viewportWidth * VIRTUAL_MARGIN_FACTOR,
    panRef,
    goHome,
    goCosmos,
    focusStar,
    didDrag,
    onCosmosPointerDown,
    onRailPointerDown,
  };
}

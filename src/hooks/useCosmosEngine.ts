import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject, RefObject } from 'react';

import { INERTIA, lambdas, stepInertia } from '../core/motion';
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
import {
  SETTLE_BELOW,
  zoomBlurPx,
  zoomDim,
  zoomPush,
  zoomScale,
  zoomTarget,
} from '../core/reader';
import type { ReaderState } from '../core/reader';
import { panBounds, panBucket, panForStar, yearAtCenter } from '../core/timeline';
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
  /** Overlay da vista de leitura. Só existe enquanto ela está montada. */
  readonly reader: RefObject<HTMLElement>;
}

/**
 * O que o laço precisa saber da vista de leitura.
 *
 * O estado em si é do React — é discreto, muda por clique. O laço só lê dele o
 * alvo do zoom e do fade, e avisa de volta uma única vez, quando o fade de
 * saída termina e a vista pode enfim sair do DOM.
 */
export interface ReaderBridge {
  readonly state: ReaderState;
  onSettled: () => void;
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
  /** Leva a câmera até a estrela, sem abrir a vista de leitura. */
  slideTo: (star: PlacedStar) => void;
  /** Põe a constelação do outro lado do portal de imediato, sem animar a travessia. */
  jumpTo: (star: PlacedStar | null) => void;
  /** Centraliza a estrela e avança a câmera. Devolve o pan de onde ela saiu. */
  openStar: (star: PlacedStar) => number;
  /** Recua a câmera até o pan que a abertura guardou. */
  closeReader: (originPan: number | null) => void;
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
  zoomS: number;
  /** x em tela da estrela aberta — origem do avanço da câmera. */
  focusX: number;
  readerFade: number;
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
  reader: ReaderBridge,
): CosmosEngine {
  const sceneRef = useRef<CoreScene | null>(null);
  // Lido dentro do laço e dos ouvintes, que não podem depender de re-render.
  const readerRef = useRef(reader);
  readerRef.current = reader;
  const state = useRef<MutableState>({
    enter: 0,
    pan: 0,
    enterS: 0,
    panS: 0,
    mouseX: 0,
    mouseY: 0,
    mouseXS: 0,
    mouseYS: 0,
    zoomS: 0,
    focusX: 0,
    readerFade: 0,
    velocity: 0,
    dragging: false,
    dragX: 0,
    dragMoved: 0,
  });

  // O laço lê o acervo para anunciar o ano na régua, sem se recriar por isso.
  const starsRef = useRef(stars);
  starsRef.current = stars;

  const [phase, setPhase] = useState<Phase>('hero');
  const [bucket, setBucket] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === 'undefined' ? 1280 : window.innerWidth,
  );

  // O laço precisa da largura sem depender de re-render nem consultar o DOM.
  const widthRef = useRef(viewportWidth);
  widthRef.current = viewportWidth;

  const bounds = useMemo(
    () => panBounds(stars, viewportWidth),
    [stars, viewportWidth],
  );
  const boundsRef = useRef(bounds);
  boundsRef.current = bounds;

  const lambda = useMemo(() => lambdas(reducedMotion), [reducedMotion]);

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

  /**
   * Desliza a câmera até uma estrela, sem abrir nada.
   *
   * É o que a busca e o filtro usam para levar o leitor ao primeiro resultado:
   * apagar as demais sem mover a câmera deixaria a tela vazia quando o que
   * corresponde está fora do enquadramento.
   */
  const slideTo = useCallback(
    (star: PlacedStar) => {
      const s = state.current;
      s.enter = 1;
      s.velocity = 0;
      s.pan = panForStar(stars, star, window.innerWidth);
    },
    [stars],
  );

  /**
   * A chegada direta pela URL.
   *
   * Aqui os valores suavizados são escritos junto com os alvos, que é
   * exatamente o que o resto do motor nunca faz. É deliberado: deixar só o alvo
   * poria o `damp` a encenar uma travessia de portal que ninguém pediu — quem
   * abriu o link de um artigo veria a viagem inteira antes de chegar ao texto.
   * A animação conta a história de ter atravessado; quem chega pela URL não
   * atravessou nada.
   */
  const jumpTo = useCallback(
    (star: PlacedStar | null) => {
      const s = state.current;
      s.enter = 1;
      s.enterS = 1;
      s.velocity = 0;
      if (star === null) return;
      s.pan = panForStar(stars, star, window.innerWidth, 0.5);
      s.panS = s.pan;
      s.focusX = star.x - s.pan;
      s.zoomS = 1;
    },
    [stars],
  );

  /**
   * O primeiro tempo da abertura: centralizar a estrela.
   *
   * O `focusX` é medido depois de o pan ser limitado pelas bordas da linha do
   * tempo — nas pontas a estrela não chega ao meio da tela, e assumir que
   * chegou faria o avanço da câmera crescer em torno do ponto errado.
   */
  const openStar = useCallback(
    (star: PlacedStar) => {
      const s = state.current;
      const originPan = s.pan;
      s.enter = 1;
      s.velocity = 0;
      s.pan = panForStar(stars, star, window.innerWidth, 0.5);
      s.focusX = star.x - s.pan;
      return originPan;
    },
    [stars],
  );

  const closeReader = useCallback((originPan: number | null) => {
    const s = state.current;
    s.velocity = 0;
    if (originPan === null) return;
    s.pan = Math.min(boundsRef.current.max, Math.max(boundsRef.current.min, originPan));
  }, []);

  const didDrag = useCallback(() => state.current.dragMoved > 0, []);

  useEffect(() => {
    /**
     * Com a vista de leitura em cena a constelação não recebe mais nada.
     *
     * Vale já durante a abertura, quando a câmera ainda viaja: rolar ali
     * deslocaria o pan que o fechamento promete devolver. E é o que devolve a
     * roda ao artigo — sem esta saída antecipada o `preventDefault` abaixo
     * impediria o texto de rolar.
     */
    const locked = (): boolean => readerRef.current.state.phase !== 'closed';

    const onResize = (): void => {
      setViewportWidth(window.innerWidth);
      sceneRef.current?.resize(window.innerWidth, window.innerHeight);
    };

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
      if (locked()) return;
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
      if (readerRef.current.state.phase !== 'closed') return;
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
      if (readerRef.current.state.phase !== 'closed') return;
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

  /**
   * O que a régua já anunciou.
   *
   * O inteiro evita um `setAttribute` por quadro. O acervo entra junto porque
   * na primeira volta ele ainda não chegou — sem estrelas não há ano, e sem
   * este segundo gatilho a régua ficaria para sempre sem `aria-valuetext`,
   * anunciando uma porcentagem que não diz nada.
   */
  const announcedRef = useRef<{
    percent: number;
    stars: readonly PlacedStar[] | null;
  }>({ percent: -1, stars: null });

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

        const reader = readerRef.current;

        s.enterS = damp(s.enterS, s.enter, lambda.enter, delta);
        s.zoomS = damp(s.zoomS, zoomTarget(reader.state), lambda.zoom, delta);
        s.panS = damp(s.panS, s.pan, lambda.pan, delta);
        s.mouseXS = damp(s.mouseXS, s.mouseX, lambda.mouse, delta);
        s.mouseYS = damp(s.mouseYS, s.mouseY, lambda.mouse, delta);

        panRef.current = s.panS;

        const enter = s.enterS;
        const zoom = s.zoomS;
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
          cosmos.style.opacity = String(reveal * zoomDim(zoom));
          cosmos.style.transform = `scale(${0.94 + reveal * 0.06})`;
          cosmos.style.pointerEvents = reveal > 0.9 ? 'auto' : 'none';
        }

        const layer = refs.layer.current;
        if (layer) {
          // A parallax cede lugar ao avanço da câmera: dois deslocamentos
          // horizontais somados leriam como tremor.
          const parallax = s.mouseXS * 10 * (1 - zoom);
          const push_ = zoomPush(s.focusX, widthRef.current, zoom);
          const x = -s.panS + parallax - push_;
          layer.style.transform =
            `translate3d(${x}px, ${s.mouseYS * -6}px, 0) scale(${zoomScale(zoom)})`;
          layer.style.transformOrigin = `${s.focusX}px 55%`;
          layer.style.filter = `blur(${zoomBlurPx(zoom)}px)`;
        }

        const scrub = refs.scrub.current;
        if (scrub) {
          scrub.style.opacity = String(reveal * 0.95 * (1 - zoom));
          scrub.style.pointerEvents = zoom > 0.3 ? 'none' : 'auto';
        }
        const fraction = panToScrubFraction(s.panS, boundsRef.current);
        const marker = refs.marker.current;
        if (marker) {
          marker.style.left = `${fraction * 100}%`;
        }

        // A régua é um `slider`: precisa dizer onde está. O inteiro é o gatilho
        // — um atributo por quadro seria ruído para a tecnologia assistiva e
        // trabalho para o navegador.
        const percent = Math.round(fraction * 100);
        const announced = announcedRef.current;
        if (percent !== announced.percent || starsRef.current !== announced.stars) {
          announcedRef.current = { percent, stars: starsRef.current };
          const rail = refs.rail.current;
          if (rail) {
            rail.setAttribute('aria-valuenow', String(percent));
            const year = yearAtCenter(starsRef.current, s.panS + widthRef.current / 2);
            if (year !== null) rail.setAttribute('aria-valuetext', String(year));
          }
        }

        // O núcleo não existe durante a exploração do cosmos: é a porta de
        // entrada e só reaparece no retorno. O canvas apaga pelo uOpacity do
        // shader; o fallback em CSS precisa apagar aqui.
        const fallback = refs.fallback.current;
        if (fallback) fallback.style.opacity = String(coreOpacity(enter));

        // A vista de leitura sobe interpolada como todo o resto: nada aparece
        // instantaneamente. Enquanto ela não está no DOM o fade fica zerado,
        // para que a próxima abertura comece do escuro.
        const overlay = refs.reader.current;
        if (overlay) {
          const target = reader.state.phase === 'open' ? 1 : 0;
          s.readerFade = damp(s.readerFade, target, lambda.readerFade, delta);
          overlay.style.opacity = String(s.readerFade);
          overlay.style.transform = `scale(${1.06 - s.readerFade * 0.06})`;
          if (target === 0 && s.readerFade < SETTLE_BELOW) {
            s.readerFade = 0;
            reader.onSettled();
          }
        } else {
          s.readerFade = 0;
        }

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
      [
        lambda,
        refs.cosmos,
        refs.fallback,
        refs.hero,
        refs.layer,
        refs.marker,
        refs.rail,
        refs.reader,
        refs.scrub,
      ],
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
    slideTo,
    jumpTo,
    openStar,
    closeReader,
    didDrag,
    onCosmosPointerDown,
    onRailPointerDown,
  };
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject, RefObject } from 'react';

import { atmosphereIntensity, generateSky, yearLayerTransform } from '../core/atmosphere';
import type { Rgb } from '../core/atmosphere';
import * as camera from '../core/camera';
import { isDrag, lambdas, stepInertia } from '../core/motion';
import {
  coreOpacity,
  cosmosReveal,
  heroFade,
  panToScrubFraction,
  phaseFor,
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
import { panBounds, panBucket, panForStar, yearAtCenter } from '../core/geometry';
import type { PlacedStar } from '../core/timeline';
import type { Category } from '../core/types';
import type { CoreScene } from '../three/CoreScene';
import { damp } from '../utils/damp';
import { hexToRgb, readColor } from '../utils/readColor';
import { useCosmosInput } from './useCosmosInput';
import type { InputState } from './useCosmosInput';
import { useFrameLoop } from './useFrameLoop';

/** Margem de virtualização, em múltiplos da largura da viewport. */
const VIRTUAL_MARGIN_FACTOR = 1.5;

/** O pan avança tanto antes de a janela de virtualização precisar mudar. */
const PAN_BUCKET_PX = 512;

export interface CosmosRefs {
  readonly hero: RefObject<HTMLElement>;
  readonly cosmos: RefObject<HTMLElement>;
  readonly layer: RefObject<HTMLElement>;
  /** Anos gigantes ao fundo. */
  readonly years: RefObject<HTMLElement>;
  readonly scrub: RefObject<HTMLElement>;
  readonly marker: RefObject<HTMLElement>;
  readonly rail: RefObject<HTMLElement>;
  /** Fallback em CSS do núcleo, quando não há WebGL. */
  readonly fallback: RefObject<HTMLElement>;
  /** Céu estático, quando não há WebGL para o procedural. */
  readonly skyFallback: RefObject<HTMLElement>;
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

/** Roxo neutro para quando o token não puder ser lido. */
const FALLBACK_TINT: Rgb = [0.55, 0.42, 1];

/** A cor da categoria, lida dos mesmos tokens que pintam as estrelas. */
function categoryRgb(category: Category): Rgb {
  return hexToRgb(readColor(`--color-cat-${category}`, ''), FALLBACK_TINT);
}

/** Estado contínuo. Mutável de propósito: é escrito a cada quadro, fora do React. */
interface MutableState extends InputState {
  mouseXS: number;
  mouseYS: number;
  zoomS: number;
  /** x em tela da estrela aberta — origem do avanço da câmera. */
  focusX: number;
  readerFade: number;
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

  // O céu é derivado do acervo inteiro, uma vez por acervo: a busca e o
  // filtro esmaecem estrelas, não recompõem a atmosfera.
  const sky = useMemo(() => generateSky(stars, categoryRgb), [stars]);
  const skyRef = useRef(sky);
  skyRef.current = sky;

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

  useEffect(() => {
    Object.assign(state.current, camera.settle(state.current, bounds));
  }, [bounds]);

  const lambda = useMemo(() => lambdas(reducedMotion), [reducedMotion]);

  // -- Entradas -------------------------------------------------------------

  /**
   * Com a vista de leitura em cena a constelação não recebe mais nada.
   *
   * Estável de propósito: os ouvintes de `useCosmosInput` dependem dele, e um
   * novo a cada render os recadastraria a cada render.
   */
  const locked = useCallback((): boolean => readerRef.current.state.phase !== 'closed', []);

  const goHome = useCallback(() => {
    Object.assign(state.current, camera.goHome(state.current, boundsRef.current));
  }, []);

  const goCosmos = useCallback(() => {
    state.current.enter = 1;
  }, []);

  const slideTo = useCallback(
    (star: PlacedStar) => {
      const pan = panForStar(stars, star, window.innerWidth);
      Object.assign(state.current, camera.slideTo(state.current, pan));
    },
    [stars],
  );

  const jumpTo = useCallback(
    (star: PlacedStar | null) => {
      const target =
        star === null ? null : { pan: panForStar(stars, star, window.innerWidth, 0.5), x: star.x };
      Object.assign(state.current, camera.jumpTo(state.current, target));
    },
    [stars],
  );

  const openStar = useCallback(
    (star: PlacedStar) => {
      const originPan = state.current.pan;
      const target = { pan: panForStar(stars, star, window.innerWidth, 0.5), x: star.x };
      Object.assign(state.current, camera.openStar(state.current, target));
      return originPan;
    },
    [stars],
  );

  const closeReader = useCallback((originPan: number | null) => {
    Object.assign(state.current, camera.closeReader(state.current, originPan, boundsRef.current));
  }, []);

  const didDrag = useCallback(() => isDrag(state.current.dragMoved), []);

  const { onCosmosPointerDown, onRailPointerDown } = useCosmosInput({
    state,
    boundsRef,
    locked,
    goHome,
    cosmos: refs.cosmos,
    rail: refs.rail,
  });

  useEffect(() => {
    const onResize = (): void => {
      setViewportWidth(window.innerWidth);
      sceneRef.current?.resize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, []);

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

          const years = refs.years.current;
          if (years) {
            const t = yearLayerTransform(s.panS, parallax, push_, zoom);
            years.style.transform = `translate3d(${t.x}px, 0, 0) scale(${t.scale})`;
          }
        }

        const scrub = refs.scrub.current;
        if (scrub) {
          scrub.style.opacity = String(reveal * 0.95 * (1 - zoom));
          // Invisível na entrada, mas ainda por cima do botão de atravessar: sem
          // a condição da revelação, o clique no botão caía na régua.
          scrub.style.pointerEvents = reveal > 0.9 && zoom <= 0.3 ? 'auto' : 'none';
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
        const skyFallback = refs.skyFallback.current;
        if (skyFallback) skyFallback.style.opacity = String(atmosphereIntensity(reveal, zoom));

        // A vista de leitura sobe interpolada como todo o resto: nada aparece
        // instantaneamente. Enquanto ela não está no DOM o fade fica zerado,
        // para que a próxima abertura comece do escuro.
        const overlay = refs.reader.current;
        if (overlay) {
          const target = reader.state.phase === 'open' ? 1 : 0;
          s.readerFade = damp(s.readerFade, target, lambda.readerFade, delta);
          overlay.style.opacity = String(s.readerFade);
          // Assentada a abertura, nenhum transform: com ele o overlay vira o
          // contêiner dos `position: fixed` de dentro, que passavam a rolar
          // com o texto (o X e a barra de progresso no celular).
          overlay.style.transform = s.readerFade > 0.995 ? 'none' : `scale(${1.06 - s.readerFade * 0.06})`;
          if (target === 0 && s.readerFade < SETTLE_BELOW) {
            s.readerFade = 0;
            reader.onSettled();
          }
        } else {
          s.readerFade = 0;
        }

        const scene = sceneRef.current;
        if (scene) {
          try {
            scene.setEnter(enter);
            scene.setPointer(s.mouseXS, s.mouseYS);
            scene.setSky(skyRef.current);
            scene.setAtmosphere(s.panS, atmosphereIntensity(reveal, zoom));
            scene.render(delta);
          } catch (error) {
            // Mesmo tratamento de quando o WebGL nunca existiu (CoreCanvas):
            // descarta a cena e deixa o fallback em CSS assumir a partir do
            // próximo quadro, em vez de tentar de novo a cada quadro.
            console.error('cena 3D falhou durante o render; caindo para o fallback em CSS', error);
            scene.dispose();
            sceneRef.current = null;
          }
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
        refs.years,
        refs.rail,
        refs.reader,
        refs.scrub,
        refs.skyFallback,
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

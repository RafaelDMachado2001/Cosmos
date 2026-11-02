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
import { homePan, panBounds, panBucket, panForStar, yearAtCenter } from '../core/geometry';
import type { PlacedStar } from '../core/timeline';
import type { Category } from '../core/types';
import type { CoreScene } from '../three/CoreScene';
import { damp } from '../utils/damp';
import { hexToRgb, readColor } from '../utils/readColor';
import { useCosmosInput } from './useCosmosInput';
import type { InputState } from './useCosmosInput';
import { useFrameLoop } from './useFrameLoop';

const VIRTUAL_MARGIN_FACTOR = 1.5;

const PAN_BUCKET_PX = 512;

export interface CosmosRefs {
  readonly hero: RefObject<HTMLElement>;
  readonly cosmos: RefObject<HTMLElement>;
  readonly layer: RefObject<HTMLElement>;
  readonly years: RefObject<HTMLElement>;
  readonly scrub: RefObject<HTMLElement>;
  readonly marker: RefObject<HTMLElement>;
  readonly rail: RefObject<HTMLElement>;
  readonly fallback: RefObject<HTMLElement>;
  readonly skyFallback: RefObject<HTMLElement>;
  readonly reader: RefObject<HTMLElement>;
}

export interface ReaderBridge {
  readonly state: ReaderState;
  onSettled: () => void;
}

export interface CosmosEngine {
  readonly sceneRef: MutableRefObject<CoreScene | null>;
  readonly phase: Phase;
  readonly panBucket: number;
  readonly viewportWidth: number;
  readonly marginPx: number;
  readonly panRef: MutableRefObject<number>;
  targetPan: () => number;
  goHome: () => void;
  goCosmos: () => void;
  slideTo: (star: PlacedStar) => void;
  jumpTo: (star: PlacedStar | null) => void;
  openStar: (star: PlacedStar) => number;
  closeReader: (originPan: number | null) => void;
  didDrag: () => boolean;
  onCosmosPointerDown: (event: React.PointerEvent) => void;
  onRailPointerDown: (event: React.PointerEvent) => void;
}

const FALLBACK_TINT: Rgb = [0.55, 0.42, 1];

function categoryRgb(category: Category): Rgb {
  return hexToRgb(readColor(`--color-cat-${category}`, ''), FALLBACK_TINT);
}

interface MutableState extends InputState {
  mouseXS: number;
  mouseYS: number;
  zoomS: number;
  focusX: number;
  readerFade: number;
}

export function useCosmosEngine(
  stars: readonly PlacedStar[],
  refs: CosmosRefs,
  reducedMotion: boolean,
  reader: ReaderBridge,
): CosmosEngine {
  const sceneRef = useRef<CoreScene | null>(null);
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

  const starsRef = useRef(stars);
  starsRef.current = stars;

  const sky = useMemo(() => generateSky(stars, categoryRgb), [stars]);
  const skyRef = useRef(sky);
  skyRef.current = sky;

  const [phase, setPhase] = useState<Phase>('hero');
  const [bucket, setBucket] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === 'undefined' ? 1280 : window.innerWidth,
  );

  const widthRef = useRef(viewportWidth);
  widthRef.current = viewportWidth;

  const bounds = useMemo(
    () => panBounds(stars, viewportWidth),
    [stars, viewportWidth],
  );
  const boundsRef = useRef(bounds);
  boundsRef.current = bounds;
  const home = useMemo(() => homePan(stars, viewportWidth), [stars, viewportWidth]);
  const homeRef = useRef(home);
  homeRef.current = home;

  useEffect(() => {
    Object.assign(state.current, camera.settle(state.current, bounds, home));
  }, [bounds, home]);

  const lambda = useMemo(() => lambdas(reducedMotion), [reducedMotion]);

  const locked = useCallback((): boolean => readerRef.current.state.phase !== 'closed', []);

  const goHome = useCallback(() => {
    Object.assign(state.current, camera.goHome(state.current, homeRef.current));
  }, []);

  const goCosmos = useCallback(() => {
    state.current.enter = 1;
  }, []);

  const targetPan = useCallback(() => state.current.pan, []);

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

  const panRef = useRef(0);

  const announcedRef = useRef<{
    percent: number;
    stars: readonly PlacedStar[] | null;
  }>({ percent: -1, stars: null });

  useFrameLoop(
    useCallback(
      (delta: number) => {
        const s = state.current;

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
          scrub.style.pointerEvents = reveal > 0.9 && zoom <= 0.3 ? 'auto' : 'none';
        }
        const fraction = panToScrubFraction(s.panS, boundsRef.current);
        const marker = refs.marker.current;
        if (marker) {
          marker.style.left = `${fraction * 100}%`;
        }

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

        const fallback = refs.fallback.current;
        if (fallback) fallback.style.opacity = String(coreOpacity(enter));
        const skyFallback = refs.skyFallback.current;
        if (skyFallback) skyFallback.style.opacity = String(atmosphereIntensity(reveal, zoom));

        const overlay = refs.reader.current;
        if (overlay) {
          const target = reader.state.phase === 'open' ? 1 : 0;
          s.readerFade = damp(s.readerFade, target, lambda.readerFade, delta);
          overlay.style.opacity = String(s.readerFade);
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
    targetPan,
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

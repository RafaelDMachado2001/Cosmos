import { useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';

import { MAX_FRAME_DELTA_S } from '../core/motion';
import {
  SMOOTH_SCROLL_LAMBDA,
  canScrollVertically,
  clampScroll,
  movedExternally,
  stepScroll,
  wheelPixels,
} from '../core/smoothScroll';

export interface SmoothScroll {
  readonly scrollTo: (top: number) => void;
}

interface Motion {
  target: number;
  current: number;
  lastWritten: number;
  frame: number;
  previous: number;
}

const REDUCED = '(prefers-reduced-motion: reduce)';

function reducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(REDUCED).matches;
}

function maxScroll(element: HTMLElement): number {
  return element.scrollHeight - element.clientHeight;
}

function innerScrollerTakes(root: HTMLElement, from: EventTarget | null, direction: number): boolean {
  let node = from instanceof Element ? from : null;
  while (node && node !== root) {
    if (node instanceof HTMLElement && node.scrollHeight > node.clientHeight) {
      const overflow = getComputedStyle(node).overflowY;
      if ((overflow === 'auto' || overflow === 'scroll') && canScrollVertically(node, direction)) {
        return true;
      }
    }
    node = node.parentElement;
  }
  return false;
}

export function useSmoothScroll(scroller: RefObject<HTMLElement>): SmoothScroll {
  const motion = useRef<Motion>({ target: 0, current: 0, lastWritten: 0, frame: 0, previous: 0 });

  const controls = useMemo(() => {
    const stop = (): void => {
      const m = motion.current;
      if (m.frame !== 0) cancelAnimationFrame(m.frame);
      m.frame = 0;
    };

    const tick = (now: number): void => {
      const m = motion.current;
      const element = scroller.current;
      m.frame = 0;
      if (!element) return;

      if (movedExternally(element.scrollTop, m.lastWritten)) return;

      const delta = Math.min((now - m.previous) / 1000, MAX_FRAME_DELTA_S);
      m.previous = now;
      const step = stepScroll(m.current, m.target, SMOOTH_SCROLL_LAMBDA, delta);
      m.current = step.top;
      element.scrollTop = step.top;
      m.lastWritten = element.scrollTop;
      if (!step.done) m.frame = requestAnimationFrame(tick);
    };

    const animateTo = (element: HTMLElement, target: number): void => {
      const m = motion.current;
      if (m.frame === 0) {
        m.current = element.scrollTop;
        m.lastWritten = element.scrollTop;
        m.previous = performance.now();
        m.frame = requestAnimationFrame(tick);
      }
      m.target = clampScroll(target, maxScroll(element));
    };

    const scrollBy = (element: HTMLElement, pixels: number): void => {
      const m = motion.current;
      const base = m.frame === 0 ? element.scrollTop : m.target;
      animateTo(element, base + pixels);
    };

    return {
      stop,
      animateTo,
      scrollBy,
      scrollTo: (top: number): void => {
        const element = scroller.current;
        if (!element) return;
        if (reducedMotion()) {
          stop();
          element.scrollTop = clampScroll(top, maxScroll(element));
          return;
        }
        animateTo(element, top);
      },
    };
  }, [scroller]);

  useEffect(() => {
    const element = scroller.current;
    if (!element) return;

    const onWheel = (event: WheelEvent): void => {
      if (event.defaultPrevented || event.ctrlKey || reducedMotion()) return;
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY) || event.deltaY === 0) return;
      const pixels = wheelPixels(event.deltaY, event.deltaMode, element.clientHeight);
      const direction = Math.sign(pixels);
      if (innerScrollerTakes(element, event.target, direction)) return;
      if (!canScrollVertically(element, direction) && motion.current.frame === 0) return;
      event.preventDefault();
      controls.scrollBy(element, pixels);
    };

    element.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      element.removeEventListener('wheel', onWheel);
      controls.stop();
    };
  }, [scroller, controls]);

  return useMemo(() => ({ scrollTo: controls.scrollTo }), [controls]);
}

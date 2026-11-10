// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useSmoothScroll } from './useSmoothScroll';
import type { SmoothScroll } from './useSmoothScroll';

let frames: FrameRequestCallback[] = [];
let clock = 0;

function runFrames(count: number): void {
  for (let i = 0; i < count; i += 1) {
    const pending = frames;
    frames = [];
    clock += 1000 / 60;
    for (const callback of pending) callback(clock);
  }
}

function Scroller({ onReady }: { onReady: (api: SmoothScroll) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const api = useSmoothScroll(ref);
  onReady(api);
  return (
    <div ref={ref} data-testid="scroller">
      <div data-testid="inner" />
    </div>
  );
}

function sized(element: HTMLElement): HTMLElement {
  Object.defineProperty(element, 'scrollHeight', { configurable: true, value: 3000 });
  Object.defineProperty(element, 'clientHeight', { configurable: true, value: 600 });
  return element;
}

function wheel(target: Element, init: WheelEventInit): WheelEvent {
  const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

beforeEach(() => {
  frames = [];
  clock = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {
    frames = [];
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function mount() {
  let api: SmoothScroll | null = null;
  const view = render(<Scroller onReady={(value) => (api = value)} />);
  const scroller = sized(view.getByTestId('scroller'));
  return { scroller, inner: view.getByTestId('inner'), api: () => api! };
}

describe('useSmoothScroll', () => {
  it('a roda vira uma animação que assenta no destino somado', () => {
    const { scroller, inner } = mount();
    const first = wheel(inner, { deltaY: 100 });
    wheel(inner, { deltaY: 100 });
    expect(first.defaultPrevented).toBe(true);

    act(() => runFrames(1));
    expect(scroller.scrollTop).toBeGreaterThan(0);
    expect(scroller.scrollTop).toBeLessThan(200);

    act(() => runFrames(200));
    expect(scroller.scrollTop).toBe(200);
    expect(frames).toHaveLength(0);
  });

  it('não para de pé no fim do conteúdo', () => {
    const { scroller, inner } = mount();
    wheel(inner, { deltaY: 10_000 });
    act(() => runFrames(300));
    expect(scroller.scrollTop).toBe(2400);
  });

  it('deixa com o navegador o zoom, a rolagem lateral e a ponta do conteúdo', () => {
    const { inner } = mount();
    expect(wheel(inner, { deltaY: 100, ctrlKey: true }).defaultPrevented).toBe(false);
    expect(wheel(inner, { deltaX: 80, deltaY: 10 }).defaultPrevented).toBe(false);
    expect(wheel(inner, { deltaY: -100 }).defaultPrevented).toBe(false);
  });

  it('cede a rolagem a uma caixa interna que ainda pode rolar', () => {
    const { inner } = mount();
    sized(inner).style.overflowY = 'auto';
    expect(wheel(inner, { deltaY: 100 }).defaultPrevented).toBe(false);
  });

  it('arrastar a barra no meio da animação cancela a animação', () => {
    const { scroller, inner } = mount();
    wheel(inner, { deltaY: 600 });
    act(() => runFrames(2));
    scroller.scrollTop = 1500;
    act(() => runFrames(5));
    expect(scroller.scrollTop).toBe(1500);
    expect(frames).toHaveLength(0);
  });

  it('a posição escrita cai sempre no pixel do aparelho', () => {
    vi.stubGlobal('devicePixelRatio', 2);
    const { scroller, inner } = mount();
    const written: number[] = [];
    let top = 0;
    Object.defineProperty(scroller, 'scrollTop', {
      configurable: true,
      get: () => top,
      set: (value: number) => {
        written.push(value);
        top = value;
      },
    });
    wheel(inner, { deltaY: 333 });
    act(() => runFrames(200));
    expect(written.length).toBeGreaterThan(5);
    expect(written.every((value) => Number.isInteger(value * 2))).toBe(true);
    expect(top).toBe(333);
  });

  it('marca a caixa enquanto rola e desmarca quando para', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { scroller } = mount();
    scroller.dispatchEvent(new Event('scroll'));
    expect(scroller.dataset.scrolling).toBe('true');
    vi.advanceTimersByTime(100);
    scroller.dispatchEvent(new Event('scroll'));
    vi.advanceTimersByTime(150);
    expect(scroller.dataset.scrolling).toBe('true');
    vi.advanceTimersByTime(100);
    expect(scroller.dataset.scrolling).toBeUndefined();
    vi.useRealTimers();
  });

  it('scrollTo anima até o alvo e respeita o movimento reduzido', () => {
    const { scroller, api } = mount();
    act(() => api().scrollTo(900));
    act(() => runFrames(200));
    expect(scroller.scrollTop).toBe(900);

    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    act(() => api().scrollTo(100));
    expect(scroller.scrollTop).toBe(100);
    expect(frames).toHaveLength(0);
  });
});

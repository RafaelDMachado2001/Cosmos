// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useFrameLoop } from './useFrameLoop';

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

describe('useFrameLoop', () => {
  it('uma exceção num quadro não cancela os quadros seguintes', async () => {
    // Aconteceu de fato: uma exceção dentro do callback (ex: a cena 3D, em
    // Chromium headless sem GPU) cancelava o próprio requestAnimationFrame
    // seguinte, travando enter/pan/fase para sempre, não só o visual 3D.
    let calls = 0;
    const onFrame = vi.fn(() => {
      calls += 1;
      if (calls === 1) throw new Error('quadro quebrado');
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    renderHook(() => {
      useFrameLoop(onFrame);
    });

    await nextFrame();
    await nextFrame();
    await nextFrame();

    expect(calls).toBeGreaterThanOrEqual(2);
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
  });
});

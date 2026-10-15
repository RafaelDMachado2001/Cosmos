// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { suppressMouseSelection } from './selection';

function pointerDown(pointerType: string, button = 0) {
  return { pointerType, button, preventDefault: vi.fn() };
}

describe('suppressMouseSelection', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('cancela o padrão e limpa a seleção no botão principal do mouse', () => {
    const removeAllRanges = vi.fn();
    vi.spyOn(document, 'getSelection').mockReturnValue({
      rangeCount: 1,
      removeAllRanges,
    } as unknown as Selection);
    const event = pointerDown('mouse');

    suppressMouseSelection(event);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(removeAllRanges).toHaveBeenCalledOnce();
  });

  it('não toca no toque nem na caneta: o padrão deles é o que rola e dá zoom', () => {
    const touch = pointerDown('touch');
    const pen = pointerDown('pen');

    suppressMouseSelection(touch);
    suppressMouseSelection(pen);

    expect(touch.preventDefault).not.toHaveBeenCalled();
    expect(pen.preventDefault).not.toHaveBeenCalled();
  });

  it('deixa o botão do meio em paz: é o que abre a estrela em nova aba', () => {
    const middle = pointerDown('mouse', 1);

    suppressMouseSelection(middle);

    expect(middle.preventDefault).not.toHaveBeenCalled();
  });

  it('não falha sem seleção para limpar', () => {
    vi.spyOn(document, 'getSelection').mockReturnValue(null);

    expect(() => {
      suppressMouseSelection(pointerDown('mouse'));
    }).not.toThrow();
  });
});

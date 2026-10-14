import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorBoundary } from './ErrorBoundary';

function Quebra(): never {
  throw new Error('falha de proposito');
}

describe('ErrorBoundary', () => {
  let shell: HTMLElement;
  let root: HTMLElement;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    document.body.innerHTML =
      '<div id="prerender" hidden><h1>Texto ja no HTML</h1></div><div id="root"></div>';
    shell = document.getElementById('prerender') as HTMLElement;
    root = document.getElementById('root') as HTMLElement;
    // O React registra o erro capturado; aqui ele e esperado.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('quando um filho quebra, devolve a casca e esconde o root', () => {
    act(() => {
      createRoot(root).render(
        <ErrorBoundary>
          <Quebra />
        </ErrorBoundary>,
      );
    });

    expect(shell.hidden).toBe(false);
    expect(shell.textContent).toContain('Texto ja no HTML');
    expect(root.hidden).toBe(true);
  });

  it('sem erro, nao mexe em nada', () => {
    act(() => {
      createRoot(root).render(
        <ErrorBoundary>
          <p>tudo bem</p>
        </ErrorBoundary>,
      );
    });

    expect(shell.hidden).toBe(true);
    expect(root.hidden).toBe(false);
    expect(root.textContent).toBe('tudo bem');
  });
});

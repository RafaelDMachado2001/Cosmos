import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../../App';

/*
 * A Shell inteira em jsdom: historico, foco e a camera que o fechamento
 * promete devolver. Mora em App.tsx; o teste monta o App, que e o que o
 * navegador monta.
 *
 * Sem WebGL aqui: o nucleo cai no fallback em CSS, que e o caminho que o
 * `webgl.ts` ja preve.
 */

/** As estrelas da constelacao, nao as ancoras do StarIndex: so elas tem o rotulo longo. */
function constellationStars(): HTMLAnchorElement[] {
  return screen
    .getAllByRole('link')
    .filter((link): link is HTMLAnchorElement =>
      (link.getAttribute('aria-label') ?? '').includes(' — '),
    );
}

/**
 * O jsdom 25 nao tem `PointerEvent`, e o `fireEvent.pointerDown` cai num
 * `Event` generico que descarta `pointerType` — justo o que se quer testar.
 */
function pointerDown(pointerType: 'mouse' | 'touch'): MouseEvent {
  const event = new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 });
  return Object.assign(event, { pointerType });
}

/** Um toque completo: o jsdom nao gera a sequencia de ponteiro sozinho. */
function tocar(element: HTMLElement): void {
  fireEvent(element, pointerDown('touch'));
  fireEvent.pointerUp(window);
  fireEvent.click(element);
}

async function entrarNaConstelacao(user: UserEvent): Promise<HTMLAnchorElement> {
  await user.click(await screen.findByRole('button', { name: 'Role para atravessar' }));
  // A fase vira `cosmos` quando a travessia suavizada passa do limiar; so
  // entao a constelacao deixa de ser `inert`. O motor libera o ponteiro um
  // pouco depois, quando a revelacao passa de 0.9 — e e isso que a pessoa
  // espera antes de conseguir clicar.
  return waitFor(
    () => {
      const star = constellationStars()[0];
      if (!star || star.closest('[inert]')) throw new Error('constelacao ainda inerte');
      for (let node: HTMLElement | null = star; node; node = node.parentElement) {
        if (getComputedStyle(node).pointerEvents === 'none') {
          throw new Error('constelacao ainda sem ponteiro');
        }
      }
      return star;
    },
    { timeout: 4000 },
  );
}

describe('Shell', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/pt');
    window.localStorage.clear();
    // jsdom nao implementa canvas: sem isto cada montagem loga um erro de
    // "not implemented" que nao diz nada sobre o que esta sendo testado.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    // jsdom declara matchMedia sem implementa-la. Sem preferencia por menos
    // movimento: e o caminho com a viagem de camera que estes testes trancam.
    window.matchMedia = (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('abrir uma estrela empilha uma entrada de historico', async () => {
    const user = userEvent.setup();
    render(<App />);
    const estrela = await entrarNaConstelacao(user);

    const antes = window.history.length;
    await user.click(estrela);

    expect(window.location.pathname).toBe(new URL(estrela.href).pathname);
    expect(window.location.pathname).toMatch(/^\/pt\/publicacoes\/[a-z0-9-]+$/);
    expect(window.history.length).toBe(antes + 1);
  });

  it('voltar fecha a vista de leitura sem exigir dois toques', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await entrarNaConstelacao(user));
    await screen.findByRole('dialog', {}, { timeout: 4000 });

    window.history.back();

    await waitFor(
      () => {
        expect(screen.queryByRole('dialog')).toBeNull();
      },
      { timeout: 4000 },
    );
    expect(window.location.pathname).toBe('/pt');
  });

  it('Esc durante a abertura fecha sem deixar a camera no meio do caminho', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await entrarNaConstelacao(user));
    // Antes do dialogo montar: e a fase `opening`, com a camera ainda viajando.
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(window.location.pathname).toBe('/pt');
    });
    // E a vista nao remonta sozinha quando o timer da abertura venceria.
    await new Promise((resolve) => setTimeout(resolve, 1200));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('fechar devolve o foco a estrela de onde se saiu', async () => {
    const user = userEvent.setup();
    render(<App />);
    const estrela = await entrarNaConstelacao(user);
    estrela.focus();
    await user.click(estrela);
    await screen.findByRole('dialog', {}, { timeout: 4000 });
    await user.keyboard('{Escape}');

    await waitFor(
      () => {
        expect(document.activeElement).toBe(estrela);
      },
      { timeout: 4000 },
    );
  });

  it('arrastar com o mouse nao seleciona texto, e o clique ainda abre a estrela', async () => {
    const user = userEvent.setup();
    render(<App />);
    const estrela = await entrarNaConstelacao(user);
    const regua = screen.getByRole('slider');

    // `fireEvent` devolve falso quando o padrao foi cancelado.
    expect(fireEvent(estrela, pointerDown('mouse'))).toBe(false);
    expect(fireEvent(regua, pointerDown('mouse'))).toBe(false);
    expect(fireEvent.dragStart(estrela)).toBe(false);
    // O toque segue nativo: e o padrao dele que distingue toque de rolagem.
    expect(fireEvent(estrela, pointerDown('touch'))).toBe(true);
    fireEvent.pointerUp(window);

    await user.click(estrela);
    expect(await screen.findByRole('dialog', {}, { timeout: 4000 })).toBeTruthy();
  });

  it('no toque, o primeiro toque mostra o painel e o segundo abre a estrela', async () => {
    const user = userEvent.setup();
    render(<App />);
    const estrela = await entrarNaConstelacao(user);

    tocar(estrela);
    expect(await screen.findByText('TOQUE DE NOVO PARA ABRIR')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(window.location.pathname).toBe('/pt');

    tocar(estrela);
    expect(await screen.findByRole('dialog', {}, { timeout: 4000 })).toBeTruthy();
  });

  it('tocar numa area vazia fecha o painel', async () => {
    const user = userEvent.setup();
    render(<App />);
    const estrela = await entrarNaConstelacao(user);
    tocar(estrela);
    await screen.findByText('TOQUE DE NOVO PARA ABRIR');

    // A camada da constelacao, fora de qualquer estrela.
    fireEvent(estrela.parentElement as HTMLElement, pointerDown('touch'));
    fireEvent.pointerUp(window);

    await waitFor(() => {
      expect(screen.queryByText('TOQUE DE NOVO PARA ABRIR')).toBeNull();
    });
  });

  it('com o mouse, um clique abre direto e o painel diz clique', async () => {
    const user = userEvent.setup();
    render(<App />);
    const estrela = await entrarNaConstelacao(user);
    await user.hover(estrela);
    expect(await screen.findByText('CLIQUE PARA ABRIR')).toBeTruthy();
  });

  it('INICIO volta a entrada pelo mesmo caminho da travessia', async () => {
    const user = userEvent.setup();
    render(<App />);
    const estrela = await entrarNaConstelacao(user);

    await user.click(screen.getByRole('button', { name: 'INÍCIO' }));

    await waitFor(
      () => {
        expect(estrela.closest('[inert]')).not.toBeNull();
      },
      { timeout: 4000 },
    );
  });

  it('carga direta num slug que nao existe mostra o 404 dentro da constelacao', async () => {
    window.history.replaceState(null, '', '/pt/publicacoes/nao-existe');
    render(<App />);

    expect(await screen.findByText('ESTA ESTRELA NÃO EXISTE', {}, { timeout: 4000 })).toBeTruthy();
  });
});

import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Member } from '../../core/session';
import type { MemberSource } from '../../data/MemberSource';
import { LocaleProvider } from '../../i18n/LocaleProvider';
import { SessionProvider } from '../../session/SessionProvider';
import { Announcer } from '../Announcer/Announcer';
import { AccountSlot } from './AccountSlot';

const MEMBER: Member = {
  id: 7,
  name: 'Camila Rocha',
  handle: 'camila_r',
  avatarUrl: null,
  email: 'camila@gmail.com',
  locale: 'pt',
  providers: ['google'],
};

function sourceWith(me: () => Promise<Member | null>): MemberSource {
  return {
    me: vi.fn(me),
    update: vi.fn(() => Promise.resolve(MEMBER)),
    logout: vi.fn(() => Promise.resolve()),
    remove: vi.fn(() => Promise.resolve()),
    exportUrl: 'https://api.test/api/me/export',
  };
}

function mount(source: MemberSource | null) {
  return render(
    <LocaleProvider initial="pt">
      <Announcer>
        <SessionProvider source={source} apiUrl="https://api.test">
          <button type="button">antes</button>
          <AccountSlot />
        </SessionProvider>
      </Announcer>
    </LocaleProvider>,
  );
}

beforeEach(() => {
  window.history.replaceState(null, '', '/pt/publicacoes/cafe');
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('AccountSlot', () => {
  it('reserva o espaço enquanto a sessão carrega, sem mostrar ENTRAR', () => {
    mount(sourceWith(() => new Promise(() => undefined)));
    expect(screen.queryByRole('button', { name: 'ENTRAR' })).toBeNull();
    expect(screen.getByText('Carregando a conta').closest('[aria-busy="true"]')).not.toBeNull();
  });

  it('API fora do ar: o slot fica vazio, sem ENTRAR', async () => {
    mount(sourceWith(() => Promise.reject(new Error('503'))));
    await act(() => Promise.resolve());
    const slot = document.querySelector('[data-state]');
    expect(slot?.getAttribute('data-state')).toBe('error');
    expect(slot?.childElementCount).toBe(0);
  });

  it('sem API nenhuma, também fica vazio', () => {
    mount(null);
    expect(document.querySelector('[data-state]')?.getAttribute('data-state')).toBe('error');
  });

  it('anônimo: ENTRAR abre o diálogo com links reais que voltam ao caminho atual', async () => {
    const user = userEvent.setup();
    mount(sourceWith(() => Promise.resolve(null)));
    const signIn = await screen.findByRole('button', { name: 'ENTRAR' });

    await user.click(signIn);
    const dialog = screen.getByRole('dialog', { name: 'Entrar no Cosmos' });
    const google = within(dialog).getByRole('link', { name: /Continuar com Google/ });
    expect(google.getAttribute('href')).toBe(
      'https://api.test/auth/google/redirect?return=%2Fpt%2Fpublicacoes%2Fcafe',
    );
    expect(document.activeElement).toBe(google);
    expect(within(dialog).getByRole('link', { name: 'Privacidade' }).getAttribute('href')).toBe(
      '/pt/privacidade',
    );
  });

  it('o diálogo prende o foco, fecha no Esc e devolve o foco a quem abriu', async () => {
    const user = userEvent.setup();
    mount(sourceWith(() => Promise.resolve(null)));
    const signIn = await screen.findByRole('button', { name: 'ENTRAR' });
    await user.click(signIn);

    const dialog = screen.getByRole('dialog');
    const close = within(dialog).getByRole('button', { name: 'Fechar' });
    await user.tab();
    await user.tab();
    await user.tab();
    expect(document.activeElement).toBe(close);
    await user.tab();
    expect(document.activeElement).toBe(within(dialog).getByRole('link', { name: /Google/ }));

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(signIn);
  });

  it('logado: o menu abre com o foco no primeiro item, as setas andam e o Esc volta ao botão', async () => {
    const user = userEvent.setup();
    mount(sourceWith(() => Promise.resolve(MEMBER)));
    const button = await screen.findByRole('button', { name: /@camila_r/ });
    expect(button.getAttribute('aria-expanded')).toBe('false');

    await user.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    const account = screen.getByRole('menuitem', { name: 'Minha conta' });
    expect(account.getAttribute('href')).toBe('/pt/conta');
    expect(document.activeElement).toBe(account);

    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Sair' }));
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(account);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it('Sair encerra a sessão, volta o ENTRAR e anuncia', async () => {
    const user = userEvent.setup();
    const logout = vi.fn(() => Promise.resolve());
    mount({ ...sourceWith(() => Promise.resolve(MEMBER)), logout });
    await user.click(await screen.findByRole('button', { name: /@camila_r/ }));
    await user.click(screen.getByRole('menuitem', { name: 'Sair' }));

    expect(logout).toHaveBeenCalledOnce();
    expect(await screen.findByRole('button', { name: 'ENTRAR' })).toBeTruthy();
    expect(await screen.findByText('Você saiu.')).toBeTruthy();
  });

  it('avatar recusado cai nas iniciais', async () => {
    mount(sourceWith(() => Promise.resolve({ ...MEMBER, avatarUrl: 'https://img.test/a.png' })));
    const button = await screen.findByRole('button', { name: /@camila_r/ });
    const image = button.querySelector('img');
    expect(image).not.toBeNull();
    act(() => {
      image?.dispatchEvent(new Event('error'));
    });
    expect(button.querySelector('img')).toBeNull();
    expect(button.textContent).toContain('CR');
  });
});

describe('volta do login', () => {
  it('?login=failed mostra o aviso; dispensar tira o parâmetro e mantém o resto', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/pt/publicacoes/cafe?login=failed#comentarios');
    mount(sourceWith(() => Promise.resolve(null)));

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('NÃO FOI POSSÍVEL ENTRAR');
    await user.click(within(alert).getByRole('button', { name: 'Dispensar' }));

    expect(screen.queryByRole('alert')).toBeNull();
    expect(`${window.location.pathname}${window.location.search}${window.location.hash}`).toBe(
      '/pt/publicacoes/cafe#comentarios',
    );
  });

  it('TENTAR DE NOVO abre o login', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/pt?login=unverified');
    mount(sourceWith(() => Promise.resolve(null)));

    expect(screen.getByRole('alert').textContent).toContain('E-MAIL NÃO VERIFICADO');
    await user.click(screen.getByRole('button', { name: /TENTAR DE NOVO/ }));
    expect(screen.getByRole('dialog', { name: 'Entrar no Cosmos' })).toBeTruthy();
    expect(window.location.search).toBe('');
  });
});

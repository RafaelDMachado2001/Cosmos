import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Member } from '../../core/session';
import { ValidationError } from '../../data/http';
import type { MemberPatch, MemberSource } from '../../data/MemberSource';
import { LocaleProvider } from '../../i18n/LocaleProvider';
import { SessionProvider } from '../../session/SessionProvider';
import { Announcer } from '../Announcer/Announcer';
import { AccountPage } from './AccountPage';

const MEMBER: Member = {
  id: 7,
  name: 'Camila Rocha',
  handle: 'camila_r',
  avatarUrl: null,
  email: 'camila@gmail.com',
  locale: 'pt',
  providers: ['google'],
};

function source(overrides: Partial<MemberSource> = {}): MemberSource {
  return {
    me: () => Promise.resolve(MEMBER),
    update: (patch: MemberPatch) => Promise.resolve({ ...MEMBER, ...patch }),
    logout: () => Promise.resolve(),
    remove: () => Promise.resolve(),
    exportUrl: 'https://api.test/api/me/export',
    ...overrides,
  };
}

function mount(members: MemberSource | null = source()) {
  return render(
    <LocaleProvider initial="pt">
      <Announcer>
        <SessionProvider source={members} apiUrl="https://api.test">
          <AccountPage />
        </SessionProvider>
      </Announcer>
    </LocaleProvider>,
  );
}

beforeEach(() => {
  window.history.replaceState(null, '', '/pt/conta');
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Minha conta', () => {
  it('mostra o perfil, as contas ligadas e o link de exportação', async () => {
    mount();
    expect(await screen.findByLabelText('Nome')).toHaveProperty('value', 'Camila Rocha');
    expect(screen.getByLabelText('@handle')).toHaveProperty('value', 'camila_r');
    expect(screen.getByText('c•••••@gmail.com')).toBeTruthy();
    expect(screen.getByText('LIGADA')).toBeTruthy();
    expect(screen.getByText('NÃO USADA')).toBeTruthy();
    const download = screen.getByRole('link', { name: /BAIXAR MEUS DADOS/ });
    expect(download.getAttribute('href')).toBe('https://api.test/api/me/export');
    expect(download.hasAttribute('download')).toBe(true);
  });

  it('salva e anuncia', async () => {
    const user = userEvent.setup();
    const update = vi.fn((patch: MemberPatch) => Promise.resolve({ ...MEMBER, ...patch }));
    mount(source({ update }));
    const name = await screen.findByLabelText('Nome');
    await user.clear(name);
    await user.type(name, 'Camila R.');
    await user.click(screen.getByRole('button', { name: 'SALVAR' }));

    expect(update).toHaveBeenCalledWith({ name: 'Camila R.', handle: 'camila_r', locale: 'pt' });
    expect(await screen.findByText('✓ Perfil salvo.')).toBeTruthy();
    expect(await screen.findByText('Perfil salvo.', { selector: '[aria-live] *, [aria-live]' })).toBeTruthy();
  });

  it('o @handle fora do formato não chega à API e o erro fica ligado ao campo', async () => {
    const user = userEvent.setup();
    const update = vi.fn(() => Promise.resolve(MEMBER));
    mount(source({ update }));
    const handle = await screen.findByLabelText('@handle');
    await user.clear(handle);
    await user.type(handle, 'ab');
    await user.click(screen.getByRole('button', { name: 'SALVAR' }));

    expect(update).not.toHaveBeenCalled();
    expect(handle.getAttribute('aria-invalid')).toBe('true');
    expect(handle.getAttribute('aria-describedby')).toContain('perfil-handle-erro');
    expect(screen.getByText('Corrija o campo marcado.')).toBeTruthy();
  });

  it('digitar em maiúsculas vira minúsculas', async () => {
    const user = userEvent.setup();
    mount();
    const handle = await screen.findByLabelText('@handle');
    await user.clear(handle);
    await user.type(handle, 'Camila_X');
    expect(handle).toHaveProperty('value', 'camila_x');
  });

  it('a API recusar o @handle mostra o erro do campo', async () => {
    const user = userEvent.setup();
    mount(
      source({
        update: () => Promise.reject(new ValidationError({ handle: ['validation.unique'] })),
      }),
    );
    await user.click(await screen.findByRole('button', { name: 'SALVAR' }));
    expect(await screen.findByText(/Este @handle não está disponível/)).toBeTruthy();
    expect(screen.getByLabelText('@handle').getAttribute('aria-invalid')).toBe('true');
  });

  it('apagar exige o @handle exato, e depois vai para a home', async () => {
    const user = userEvent.setup();
    const remove = vi.fn(() => Promise.resolve());
    const assign = vi.fn();
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, assign });
    mount(source({ remove }));

    const opener = await screen.findByRole('button', { name: 'APAGAR MINHA CONTA' });
    await user.click(opener);
    const dialog = screen.getByRole('alertdialog', { name: 'Apagar sua conta?' });
    const input = within(dialog).getByLabelText('Para confirmar, digite @camila_r');
    expect(document.activeElement).toBe(input);
    const confirm = within(dialog).getByRole('button', { name: 'APAGAR MINHA CONTA' });
    expect(confirm).toHaveProperty('disabled', true);

    await user.type(input, '@camila');
    expect(confirm).toHaveProperty('disabled', true);
    await user.type(input, '_r');
    expect(confirm).toHaveProperty('disabled', false);
    await user.click(confirm);

    expect(remove).toHaveBeenCalledOnce();
    await vi.waitFor(() => {
      expect(assign).toHaveBeenCalledWith('/pt');
    });
    expect(window.sessionStorage.getItem('rdm:cosmos:account-deleted')).toBe('1');
  });

  it('cancelar fecha o diálogo e devolve o foco', async () => {
    const user = userEvent.setup();
    mount();
    const opener = await screen.findByRole('button', { name: 'APAGAR MINHA CONTA' });
    await user.click(opener);
    await user.click(screen.getByRole('button', { name: 'CANCELAR' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('anônimo: convida a entrar, voltando para a conta', async () => {
    const user = userEvent.setup();
    mount(source({ me: () => Promise.resolve(null) }));
    const main = await screen.findByRole('main');
    await user.click(await within(main).findByRole('button', { name: 'ENTRAR' }));
    const google = screen.getByRole('link', { name: /Google/ });
    expect(google.getAttribute('href')).toContain('return=%2Fpt%2Fconta');
  });

  it('API fora do ar: avisa e tenta de novo', async () => {
    const user = userEvent.setup();
    const me = vi
      .fn<() => Promise<Member | null>>()
      .mockRejectedValueOnce(new Error('503'))
      .mockResolvedValueOnce(MEMBER);
    mount(source({ me }));
    expect(await screen.findByText('Não foi possível carregar sua conta agora.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'TENTAR DE NOVO' }));
    expect(await screen.findByLabelText('Nome')).toBeTruthy();
  });

  it('trocar o idioma troca o endereço para o segmento do outro idioma', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByLabelText('Nome');
    await user.click(screen.getByRole('button', { name: 'EN' }));
    expect(window.location.pathname).toBe('/en/account');
    expect(document.title).toBe('My account · RDM Labs · Cosmos');
  });
});

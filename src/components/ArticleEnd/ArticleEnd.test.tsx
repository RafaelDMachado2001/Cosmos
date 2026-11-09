import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CommentsPage, CommunityComment, ReactionState } from '../../core/community';
import type { Member } from '../../core/session';
import type { CommunitySource } from '../../data/CommunitySource';
import { RateLimitedError, UnauthorizedError, ValidationError } from '../../data/http';
import type { MemberSource } from '../../data/MemberSource';
import { LocaleProvider } from '../../i18n/LocaleProvider';
import { SessionProvider } from '../../session/SessionProvider';
import { Announcer } from '../Announcer/Announcer';
import { ArticleEnd } from './ArticleEnd';

const ME: Member = {
  id: 1,
  name: 'Camila Rocha',
  handle: 'camila_r',
  avatarUrl: null,
  email: null,
  locale: 'pt',
  providers: ['github'],
};

const comment = (id: number, handle: string, body = `C${String(id)}`): CommunityComment => ({
  id,
  body,
  createdAt: new Date(Date.now() - 3_600_000).toISOString(),
  author: { name: handle === 'camila_r' ? 'Camila Rocha' : '', handle, avatarUrl: null },
});

function community(overrides: Partial<CommunitySource> = {}): CommunitySource {
  return {
    comments: () =>
      Promise.resolve<CommentsPage>({
        items: [comment(1, 'ana'), comment(2, 'camila_r')],
        next: null,
        total: 2,
      }),
    post: (_slug, _locale, body) => Promise.resolve(comment(9, 'camila_r', body)),
    remove: () => Promise.resolve(),
    reaction: () => Promise.resolve<ReactionState>({ count: 12, reacted: false }),
    react: (_slug, _locale, on) => Promise.resolve({ count: on ? 13 : 12, reacted: on }),
    ...overrides,
  };
}

function members(member: Member | null): MemberSource {
  return {
    me: () => Promise.resolve(member),
    update: () => Promise.resolve(ME),
    logout: () => Promise.resolve(),
    remove: () => Promise.resolve(),
    exportUrl: '',
  };
}

function mount(source: CommunitySource | null, member: Member | null = ME) {
  return render(
    <LocaleProvider initial="pt">
      <Announcer>
        <SessionProvider source={members(member)} apiUrl="https://api.test">
          <ArticleEnd
            source={source}
            slug="cafe"
            title="Café"
            url="https://cosmos.test/pt/publicacoes/cafe"
            scrollRootRef={createRef<HTMLElement>()}
          />
        </SessionProvider>
      </Announcer>
    </LocaleProvider>,
  );
}

const field = () => screen.getByLabelText('SEU COMENTÁRIO');

beforeEach(() => {
  window.history.replaceState(null, '', '/pt/publicacoes/cafe');
  window.sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('fim de artigo, logado', () => {
  it('lista os comentários com a contagem, e só o próprio tem APAGAR', async () => {
    mount(community());
    expect(await screen.findByText('C1')).toBeTruthy();
    expect(screen.getByRole('heading', { name: /COMENTÁRIOS 2/ })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /Apagar seu comentário/ })).toHaveLength(1);
    expect(screen.getByText('@ana')).toBeTruthy();
  });

  it('acender é otimista e mostra a contagem como frase', async () => {
    const user = userEvent.setup();
    mount(community());
    const button = await screen.findByRole('button', { name: 'ACENDER' });
    expect(screen.getByText('12 acenderam')).toBeTruthy();
    await user.click(button);
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(await screen.findByText('13 acenderam')).toBeTruthy();
    expect(button.textContent).toContain('ACESA');
  });

  it('se a API recusar a reação, volta ao estado anterior e avisa', async () => {
    const user = userEvent.setup();
    mount(community({ react: () => Promise.reject(new Error('500')) }));
    const button = await screen.findByRole('button', { name: 'ACENDER' });
    await user.click(button);
    expect(await screen.findByText('Não foi possível registrar a marcação.')).toBeTruthy();
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByText('12 acenderam')).toBeTruthy();
  });

  it('publicar acrescenta no fim, limpa o campo e anuncia', async () => {
    const user = userEvent.setup();
    mount(community());
    await screen.findByText('C1');
    await user.type(field(), 'Linha um{Enter}linha dois');
    await user.click(screen.getByRole('button', { name: 'PUBLICAR' }));

    const items = await screen.findAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[2]?.textContent).toContain('Linha um\nlinha dois');
    expect(items[2]?.getAttribute('data-fresh')).toBe('true');
    expect(field()).toHaveProperty('value', '');
    expect(screen.getByRole('heading', { name: /COMENTÁRIOS 3/ })).toBeTruthy();
    expect(await screen.findByText('✓ Comentário publicado.')).toBeTruthy();
  });

  it.each([
    [new ValidationError({ body: ['x'] }), /passou de 2\.000 caracteres/],
    [new RateLimitedError('x'), /Muitos comentários em pouco tempo/],
    [new UnauthorizedError('x'), /Sua sessão expirou/],
  ])('a recusa vira mensagem ligada ao campo: %s', async (failure, message) => {
    const user = userEvent.setup();
    mount(community({ post: () => Promise.reject(failure) }));
    await screen.findByText('C1');
    await user.type(field(), 'Texto');
    await user.click(screen.getByRole('button', { name: 'PUBLICAR' }));

    const error = await screen.findByText(message);
    expect(field().getAttribute('aria-invalid')).toBe('true');
    expect(field().getAttribute('aria-describedby')).toContain(error.closest('p')?.id ?? '-');
    expect(field()).toHaveProperty('value', 'Texto');
  });

  it('sessão expirada guarda o rascunho e oferece entrar de novo, voltando aos comentários', async () => {
    const user = userEvent.setup();
    mount(community({ post: () => Promise.reject(new UnauthorizedError('x')) }));
    await screen.findByText('C1');
    await user.type(field(), 'Não perca isto');
    await user.click(screen.getByRole('button', { name: 'PUBLICAR' }));
    await user.click(await screen.findByRole('button', { name: 'Entrar de novo' }));

    expect(window.sessionStorage.getItem('rdm:cosmos:comment-draft:pt:cafe')).toBe('Não perca isto');
    const google = screen.getByRole('link', { name: /Google/ });
    expect(google.getAttribute('href')).toContain(
      'return=%2Fpt%2Fpublicacoes%2Fcafe%23comentarios',
    );
  });

  it('o rascunho volta ao campo, e chegar por #comentarios rola até o bloco e foca o campo', async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    window.sessionStorage.setItem('rdm:cosmos:comment-draft:pt:cafe', 'Rascunho salvo');
    window.history.replaceState(null, '', '/pt/publicacoes/cafe#comentarios');
    mount(community());
    const input = await screen.findByLabelText('SEU COMENTÁRIO');
    expect(input).toHaveProperty('value', 'Rascunho salvo');
    expect(document.activeElement).toBe(input);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
  });

  it('o contador aparece perto do teto e o excesso trava o PUBLICAR', async () => {
    mount(community());
    await screen.findByText('C1');
    const input = field();
    act(() => {
      input.focus();
    });
    const user = userEvent.setup();
    await user.click(input);
    await user.paste('a'.repeat(2001));
    expect(screen.getByText('2.001 / 2.000').getAttribute('data-visible')).toBe('true');
    expect(screen.getByRole('button', { name: 'PUBLICAR' })).toHaveProperty('disabled', true);
    expect(screen.getByText(/passou de 2\.000 caracteres/)).toBeTruthy();
  });

  it('apagar pede confirmação com o foco em CANCELAR, e tira da lista', async () => {
    const user = userEvent.setup();
    const remove = vi.fn(() => Promise.resolve());
    mount(community({ remove }));
    await user.click(await screen.findByRole('button', { name: /Apagar seu comentário/ }));
    const dialog = screen.getByRole('alertdialog', { name: 'Apagar comentário?' });
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'CANCELAR' }));

    await user.click(within(dialog).getByRole('button', { name: 'APAGAR' }));
    expect(remove).toHaveBeenCalledWith(2);
    expect(await screen.findByText('Comentário apagado.')).toBeTruthy();
    expect(screen.queryByText('C2')).toBeNull();
    expect(screen.getByRole('heading', { name: /COMENTÁRIOS 1/ })).toBeTruthy();
  });

  it('carregar mais traz a próxima página pelo cursor', async () => {
    const user = userEvent.setup();
    const comments = vi
      .fn<CommunitySource['comments']>()
      .mockResolvedValueOnce({ items: [comment(1, 'ana')], next: 1, total: 2 })
      .mockResolvedValueOnce({ items: [comment(5, 'bia')], next: null, total: 2 });
    mount(community({ comments }));
    await user.click(await screen.findByRole('button', { name: 'CARREGAR MAIS · 1' }));
    expect(await screen.findByText('C5')).toBeTruthy();
    expect(comments).toHaveBeenLastCalledWith('cafe', 'pt', 1);
    expect(screen.queryByRole('button', { name: /CARREGAR MAIS/ })).toBeNull();
  });
});

describe('fim de artigo, sem conta ou sem API', () => {
  it('anônimo: convite para entrar, e a reação também abre o login', async () => {
    const user = userEvent.setup();
    mount(community(), null);
    expect(await screen.findByText('Entre para comentar')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'ACENDER' }));
    expect(screen.getByRole('dialog', { name: 'Entrar no Cosmos' })).toBeTruthy();
    expect(screen.getByText('Entre para marcar')).toBeTruthy();
  });

  it('comentários fora do ar: painel com tentar de novo, e o compartilhar continua', async () => {
    const user = userEvent.setup();
    const comments = vi
      .fn<CommunitySource['comments']>()
      .mockRejectedValueOnce(new Error('503'))
      .mockResolvedValue({ items: [comment(1, 'ana')], next: null, total: 1 });
    mount(community({ comments }));
    expect(await screen.findByText(/Os comentários não carregaram/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copiar link' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'TENTAR DE NOVO' }));
    expect(await screen.findByText('C1')).toBeTruthy();
  });

  it('sem API: só o compartilhar', () => {
    mount(null);
    expect(screen.queryByRole('heading', { name: /COMENTÁRIOS/ })).toBeNull();
    expect(screen.getByRole('link', { name: 'Compartilhar no LinkedIn' })).toBeTruthy();
  });
});

describe('contagem da reação', () => {
  it.each([
    [0, 'Ninguém acendeu ainda'],
    [1, '1 acendeu'],
    [2000, '2.000 acenderam'],
  ])('%i vira "%s"', async (count, text) => {
    mount(community({ reaction: () => Promise.resolve({ count, reacted: false }) }));
    expect(await screen.findByText(text)).toBeTruthy();
  });
});

describe('compartilhar', () => {
  it('sem menu nativo: copiar avisa e troca o rótulo', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(() => Promise.resolve());
    vi.spyOn(navigator, 'clipboard', 'get').mockReturnValue({ writeText } as unknown as Clipboard);
    mount(null);
    await user.click(screen.getByRole('button', { name: 'Copiar link' }));
    expect(writeText).toHaveBeenCalledWith('https://cosmos.test/pt/publicacoes/cafe');
    expect(await screen.findByRole('button', { name: 'Link copiado' })).toBeTruthy();
    expect(await screen.findByText('Link copiado para a área de transferência.')).toBeTruthy();
  });

  it('com menu nativo: um botão só, que chama navigator.share', async () => {
    const user = userEvent.setup();
    const share = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    try {
      mount(null);
      await user.click(screen.getByRole('button', { name: 'COMPARTILHAR' }));
      expect(share).toHaveBeenCalledWith({
        url: 'https://cosmos.test/pt/publicacoes/cafe',
        title: 'Café',
      });
      expect(screen.queryByRole('button', { name: 'Copiar link' })).toBeNull();
    } finally {
      Reflect.deleteProperty(navigator, 'share');
    }
  });
});

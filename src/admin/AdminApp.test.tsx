import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminApp } from './AdminApp';
import type { AdminPublication } from './api';

const { api } = vi.hoisted(() => ({
  api: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    destroy: vi.fn(),
    publish: vi.fn(),
    unpublish: vi.fn(),
    uploadMedia: vi.fn(),
    searchTags: vi.fn(),
  },
}));

vi.mock('./api', () => ({ api }));

function publication(overrides: Partial<AdminPublication> = {}): AdminPublication {
  return {
    id: 1,
    slug: 'code-review-sem-atrito',
    category: 'artigo',
    publishedAt: '2025-09-09T00:00:00.000Z',
    featured: false,
    indexable: true,
    status: 'draft',
    pendingChanges: false,
    appearance: null,
    tags: [],
    references: [],
    drafts: {
      pt: {
        locale: 'pt',
        title: 'Code review sem atrito',
        subtitle: 'Revisar sem travar o time.',
        blocks: [{ id: 'b0', type: 'p', text: 'Um parágrafo.' }],
        seoTitle: null,
        seoDescription: null,
        updatedAt: null,
      },
    },
    ...overrides,
  };
}

describe('AdminApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '<div id="admin-root"></div>';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lista as publicações e mostra o estado vazio sem seleção', async () => {
    api.list.mockResolvedValue([publication()]);

    render(<AdminApp />);

    expect(await screen.findByText('Code review sem atrito')).not.toBeNull();
    expect(screen.getByText(/selecione uma publicação/i)).not.toBeNull();
  });

  it('clicar numa publicação abre o editor com o título carregado', async () => {
    api.list.mockResolvedValue([publication()]);
    const user = userEvent.setup();

    render(<AdminApp />);

    const item = await screen.findByText('Code review sem atrito');
    await user.click(item);

    expect(await screen.findByDisplayValue('Code review sem atrito')).not.toBeNull();
  });

  it('abre direto na publicação do endereço, e o endereço segue a seleção', async () => {
    api.list.mockResolvedValue([publication(), publication({ id: 7, slug: 'outra', drafts: {} })]);
    window.history.replaceState(null, '', '/admin/studio?publication=1');

    render(<AdminApp initialSelectedId={1} />);

    expect(await screen.findByDisplayValue('Code review sem atrito')).not.toBeNull();
    expect(window.location.search).toBe('?publication=1');
  });

  it('um id que não está no acervo vira estado vazio e sai do endereço', async () => {
    api.list.mockResolvedValue([publication()]);
    window.history.replaceState(null, '', '/admin/studio?publication=99');

    render(<AdminApp initialSelectedId={99} />);

    expect(await screen.findByText(/selecione uma publicação/i)).not.toBeNull();
    await waitFor(() => expect(window.location.search).toBe(''));
  });

  it('"+ Nova" cria uma publicação e a seleciona', async () => {
    api.list.mockResolvedValue([]);
    const created = publication({ id: 2, slug: 'rascunho-123', drafts: {} });
    api.create.mockResolvedValue(created);
    const user = userEvent.setup();

    render(<AdminApp />);

    await screen.findByText(/nada encontrado/i);
    await user.click(screen.getByRole('button', { name: '+ Nova' }));

    await waitFor(() => expect(api.create).toHaveBeenCalledTimes(1));
    expect(await screen.findByPlaceholderText('Título')).not.toBeNull();
  });

  it('publicar logo depois de editar salva o rascunho antes, e só então publica', async () => {
    api.list.mockResolvedValue([publication()]);
    api.update.mockImplementation((_id: number, patch: unknown) =>
      Promise.resolve({ ...publication(), patch }),
    );
    api.publish.mockResolvedValue(publication({ status: 'published' }));
    const user = userEvent.setup();

    render(<AdminApp />);
    await user.click(await screen.findByText('Code review sem atrito'));
    const title = await screen.findByDisplayValue('Code review sem atrito');

    await user.type(title, ' agora');
    // Sem esperar os 400ms do autosave.
    await user.click(screen.getByRole('button', { name: 'Publicar' }));

    await waitFor(() => expect(api.publish).toHaveBeenCalledTimes(1));
    expect(api.update).toHaveBeenCalled();
    const lastPatch = api.update.mock.calls.at(-1)?.[1] as { drafts: { pt: { title: string } } };
    expect(lastPatch.drafts.pt.title).toBe('Code review sem atrito agora');
    expect(api.update.mock.invocationCallOrder.at(-1)).toBeLessThan(
      api.publish.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('se o salvamento falha, não publica', async () => {
    api.list.mockResolvedValue([publication()]);
    api.update.mockRejectedValue(new Error('500'));
    const user = userEvent.setup();

    render(<AdminApp />);
    await user.click(await screen.findByText('Code review sem atrito'));
    await user.type(await screen.findByDisplayValue('Code review sem atrito'), '!');
    await user.click(screen.getByRole('button', { name: 'Publicar' }));

    expect(await screen.findByText('Não foi possível publicar.')).not.toBeNull();
    expect(api.publish).not.toHaveBeenCalled();
  });

  it('publicada: "Atualizar publicado" salva e republica, e acusa o que está pendente', async () => {
    const live = publication({ status: 'published', pendingChanges: true });
    api.list.mockResolvedValue([live]);
    api.update.mockResolvedValue(live);
    api.publish.mockResolvedValue({ ...live, pendingChanges: false });
    const user = userEvent.setup();

    render(<AdminApp />);
    await user.click(await screen.findByText('Code review sem atrito'));

    expect(await screen.findByText(/ainda não estão no ar/)).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Publicar' })).toBeNull();

    await user.type(await screen.findByDisplayValue('Code review sem atrito'), '!');
    await user.click(screen.getByRole('button', { name: 'Atualizar publicado' }));

    await waitFor(() => expect(api.publish).toHaveBeenCalledTimes(1));
    expect(api.update.mock.invocationCallOrder.at(-1)).toBeLessThan(
      api.publish.mock.invocationCallOrder[0] ?? 0,
    );
    await waitFor(() => expect(screen.queryByText(/ainda não estão no ar/)).toBeNull());
  });

  it('Ctrl+S manda o rascunho sem esperar o autosave', async () => {
    api.list.mockResolvedValue([publication()]);
    api.update.mockResolvedValue(publication());
    const user = userEvent.setup();

    render(<AdminApp />);
    await user.click(await screen.findByText('Code review sem atrito'));
    await user.type(await screen.findByDisplayValue('Code review sem atrito'), '!');
    await user.keyboard('{Control>}s{/Control}');

    await waitFor(() => expect(api.update).toHaveBeenCalledTimes(1));
    expect(api.publish).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Salvar' })).toBeNull();
  });

  it('data futura fora do ar: o botão agenda', async () => {
    api.list.mockResolvedValue([publication({ publishedAt: '2999-01-01T12:00:00.000Z' })]);
    const user = userEvent.setup();

    render(<AdminApp />);
    await user.click(await screen.findByText('Code review sem atrito'));

    expect(await screen.findByRole('button', { name: 'Agendar' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Publicar' })).toBeNull();
  });

  it('Copiar link: só com a publicação no ar, e copia o endereço do artigo', async () => {
    const live = publication({ status: 'published' });
    api.list.mockResolvedValue([publication({ id: 2, slug: 'rascunho' }), live]);
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();

    render(<AdminApp />);
    await user.click((await screen.findAllByText('Code review sem atrito'))[0] as HTMLElement);
    expect((await screen.findByRole('button', { name: 'Copiar link' })).hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('Disponível com a publicação no ar.')).not.toBeNull();

    await user.click((await screen.findAllByText('Code review sem atrito'))[1] as HTMLElement);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copiar link' }).hasAttribute('disabled')).toBe(false));
    await user.click(screen.getByRole('button', { name: 'Copiar link' }));

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/pt/publicacoes/code-review-sem-atrito`);
    expect(await screen.findByText('Link copiado.')).not.toBeNull();
  });

  it('Aparência: desligar "Herdar" grava o padrão, e o controle salva o valor', async () => {
    api.list.mockResolvedValue([publication()]);
    api.update.mockResolvedValue(publication());
    const user = userEvent.setup();

    render(<AdminApp />);
    await user.click(await screen.findByText('Code review sem atrito'));

    const motion = await screen.findByRole('checkbox', { name: 'Movimento' });
    expect((motion as HTMLInputElement).disabled).toBe(true);

    await user.click(screen.getByRole('checkbox', { name: 'Herdar da categoria' }));
    await user.click(screen.getByRole('checkbox', { name: 'Movimento' }));
    await user.keyboard('{Control>}s{/Control}');

    await waitFor(() => expect(api.update).toHaveBeenCalled());
    const patch = api.update.mock.calls.at(-1)?.[1] as { appearance: unknown };
    expect(patch.appearance).toEqual({ nebula: 0.3, motion: false });
  });
});

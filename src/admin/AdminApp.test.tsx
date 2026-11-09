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
    engagement: { comments: 0, reactions: 0, moderationUrl: null },
    appearance: null,
    tags: { pt: [], en: [] },
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

  it('cada idioma edita as próprias tags, e o autosave leva as duas listas', async () => {
    const aberta = publication({ tags: { pt: ['indices'], en: ['indexes'] } });
    api.list.mockResolvedValue([aberta]);
    api.update.mockResolvedValue(aberta);
    api.searchTags.mockResolvedValue(['performance']);
    const user = userEvent.setup();

    render(<AdminApp initialSelectedId={1} />);

    expect(await screen.findByRole('button', { name: 'indices ✕' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'indexes ✕' })).toBeNull();

    await user.click(screen.getByRole('tab', { name: /english|inglês/i }));

    expect(screen.getByRole('button', { name: 'indexes ✕' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'indices ✕' })).toBeNull();

    await user.type(screen.getByPlaceholderText('Adicionar tag…'), 'perf');
    await waitFor(() => expect(api.searchTags).toHaveBeenLastCalledWith('perf', 'en'));
    await user.click(await screen.findByRole('button', { name: 'performance' }));

    await waitFor(() => expect(api.update).toHaveBeenCalled(), { timeout: 3000 });
    expect(api.update.mock.lastCall?.[1]).toMatchObject({
      tags: { pt: ['indices'], en: ['indexes', 'performance'] },
    });
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
    await user.click(screen.getByRole('button', { name: 'Publicar' }));

    await waitFor(() => expect(api.publish).toHaveBeenCalledTimes(1));
    expect(api.update).toHaveBeenCalled();
    const lastPatch = api.update.mock.calls.at(-1)?.[1] as { drafts: { pt: { title: string } } };
    expect(lastPatch.drafts.pt.title).toBe('Code review sem atrito agora');
    expect(api.update.mock.invocationCallOrder.at(-1)).toBeLessThan(
      api.publish.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('diagrama inválido em qualquer idioma impede publicar, sem chamar a API', async () => {
    const base = publication();
    api.list.mockResolvedValue([
      publication({
        drafts: {
          ...base.drafts,
          en: {
            locale: 'en',
            title: 'T',
            subtitle: '',
            blocks: [{ id: 'd0', type: 'diagram', source: 'flow f\na -> b' }],
            seoTitle: null,
            seoDescription: null,
            updatedAt: null,
          },
        },
      }),
    ]);
    const user = userEvent.setup();

    render(<AdminApp />);
    await user.click(await screen.findByText('Code review sem atrito'));
    await user.click(await screen.findByRole('button', { name: 'Publicar' }));

    expect(await screen.findByText(/Corrija o diagrama antes de publicar\. linha 2/)).not.toBeNull();
    expect(api.publish).not.toHaveBeenCalled();
  });

  it('a pré-visualização usa a cor da categoria', async () => {
    api.list.mockResolvedValue([publication({ category: 'rotina' })]);
    const user = userEvent.setup();

    render(<AdminApp />);
    await user.click(await screen.findByText('Code review sem atrito'));
    await user.click(await screen.findByRole('button', { name: 'Pré-visualizar' }));

    const preview = screen.getByText('Um parágrafo.').parentElement;
    expect(preview?.style.getPropertyValue('--cat')).toBe('var(--color-cat-rotina)');
  });

  it('a pré-visualização descreve o diagrama no idioma da aba', async () => {
    const base = publication();
    const pt = base.drafts.pt;
    if (pt === undefined) throw new Error('fixture sem pt');
    const blocks = [{ id: 'b0', type: 'diagram', source: 'flow f\na "A"\nb "B"\na -> b' }] as const;
    api.list.mockResolvedValue([
      publication({ drafts: { pt: { ...pt, blocks }, en: { ...pt, locale: 'en', blocks } } }),
    ]);
    const user = userEvent.setup();

    render(<AdminApp />);
    await user.click(await screen.findByText('Code review sem atrito'));
    await user.click(await screen.findByRole('button', { name: 'Pré-visualizar' }));
    expect(document.querySelector('desc')?.textContent).toBe('A para B.');

    await user.click(screen.getByRole('tab', { name: 'English' }));
    expect(document.querySelector('desc')?.textContent).toBe('A to B.');
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

  it('publicada: mostra comentários e reações, com o atalho para moderar', async () => {
    const live = publication({
      status: 'published',
      engagement: { comments: 2, reactions: 1, moderationUrl: '/admin/comments?filters[publication_id][value]=1' },
    });
    api.list.mockResolvedValue([live]);
    const user = userEvent.setup();

    render(<AdminApp />);
    expect(await screen.findByText('2 comentários')).not.toBeNull();
    await user.click(await screen.findByText('Code review sem atrito'));

    expect(await screen.findByText(/2 comentários · 1 reação/)).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Moderar' }).getAttribute('href')).toBe(
      '/admin/comments?filters[publication_id][value]=1',
    );
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

  it('bloco em branco fica na tela, mas não vai no salvamento', async () => {
    api.list.mockResolvedValue([publication()]);
    api.update.mockResolvedValue(publication());
    const user = userEvent.setup();

    render(<AdminApp />);
    await user.click(await screen.findByText('Code review sem atrito'));
    await user.click(await screen.findByRole('button', { name: '+ Diagrama' }));
    await user.keyboard('{Control>}s{/Control}');

    await waitFor(() => expect(api.update).toHaveBeenCalledTimes(1));
    const patch = api.update.mock.calls[0]?.[1] as { drafts: { pt: { blocks: readonly { type: string }[] } } };
    expect(patch.drafts.pt.blocks.map(({ type }) => type)).not.toContain('diagram');
    expect(screen.getByRole('textbox', { name: 'Fonte do diagrama' })).toBeDefined();
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

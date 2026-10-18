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
});

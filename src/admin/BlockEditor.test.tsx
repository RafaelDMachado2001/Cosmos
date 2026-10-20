import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BlockEditor } from './BlockEditor';
import type * as apiModule from './api';
import { PayloadTooLargeError } from './api';

const { uploadMedia } = vi.hoisted(() => ({ uploadMedia: vi.fn() }));

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof apiModule>()),
  api: { uploadMedia },
}));

afterEach(cleanup);

const IMAGE_BLOCK = { id: 'b0', type: 'img', url: '', mediaId: null, alt: '', caption: null } as const;

function fileInput(): HTMLInputElement {
  const input = document.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement)) throw new Error('sem input de arquivo');
  return input;
}

describe('BlockEditor: upload de imagem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('acima de 20 MB avisa sem enviar', async () => {
    render(<BlockEditor blocks={[IMAGE_BLOCK]} onChange={vi.fn()} />);

    const file = new File(['x'], 'grande.jpg', { type: 'image/jpeg' });
    Object.defineProperty(file, 'size', { value: 21 * 1024 * 1024 });
    await userEvent.upload(fileInput(), file);

    expect((await screen.findByRole('alert')).textContent).toMatch(/20 MB/);
    expect(uploadMedia).not.toHaveBeenCalled();
  });

  it('o 413 do servidor vira o mesmo aviso, não um envio que some calado', async () => {
    uploadMedia.mockRejectedValue(new PayloadTooLargeError('/media'));
    const onChange = vi.fn();
    render(<BlockEditor blocks={[IMAGE_BLOCK]} onChange={onChange} />);

    await userEvent.upload(fileInput(), new File(['x'], 'foto.jpg', { type: 'image/jpeg' }));

    expect((await screen.findByRole('alert')).textContent).toMatch(/20 MB/);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('BlockEditor: inserir', () => {
  const BLOCKS = [
    { id: 'b0', type: 'p', text: 'Primeiro.' },
    { id: 'b1', type: 'p', text: 'Segundo.' },
    { id: 'b2', type: 'p', text: 'Terceiro.' },
  ] as const;

  it('sem bloco em foco, insere no fim', async () => {
    const onChange = vi.fn();
    render(<BlockEditor blocks={BLOCKS} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: '+ Citação' }));

    const next = onChange.mock.calls[0]?.[0] as { type: string }[];
    expect(next.map((block) => block.type)).toEqual(['p', 'p', 'p', 'quote']);
  });

  it('insere logo depois do bloco em que se está, não no fim', async () => {
    const onChange = vi.fn();
    render(<BlockEditor blocks={BLOCKS} onChange={onChange} />);

    await userEvent.click(screen.getByDisplayValue('Primeiro.'));
    expect(screen.getByText('Inserir após o bloco 1')).not.toBeNull();
    await userEvent.click(screen.getByRole('button', { name: '+ Citação' }));

    const next = onChange.mock.calls[0]?.[0] as { id: string; type: string }[];
    expect(next.map((block) => block.type)).toEqual(['p', 'quote', 'p', 'p']);
    expect(next[0]?.id).toBe('b0');
  });
});

describe('BlockEditor: tabela', () => {
  const TABLE = {
    id: 't0',
    type: 'table',
    align: [null, null],
    header: ['Nome', 'Valor'],
    rows: [['a', '1']],
  } as const;

  it('adicionar coluna mantém uma célula por coluna em toda linha', async () => {
    const onChange = vi.fn();
    render(<BlockEditor blocks={[TABLE]} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: '+ coluna' }));

    expect(onChange.mock.calls[0]?.[0]).toEqual([
      { ...TABLE, align: [null, null, null], header: ['Nome', 'Valor', ''], rows: [['a', '1', '']] },
    ]);
  });

  it('o alinhamento gira entre padrão, esquerda, centro e direita', async () => {
    const onChange = vi.fn();
    render(<BlockEditor blocks={[TABLE]} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: /Alinhamento da coluna 2/ }));

    expect(onChange.mock.calls[0]?.[0]).toEqual([{ ...TABLE, align: [null, 'left'] }]);
  });
});

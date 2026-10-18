import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BlockEditor } from './BlockEditor';
import type * as apiModule from './api';
import { PayloadTooLargeError } from './api';

const { uploadMedia } = vi.hoisted(() => ({ uploadMedia: vi.fn() }));

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof apiModule>()),
  api: { uploadMedia },
}));

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

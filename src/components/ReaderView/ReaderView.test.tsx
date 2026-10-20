import { cleanup, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ReaderView } from './ReaderView';
import type { ReaderCard } from './ReaderView';
import { DEFAULT_APPEARANCE } from '../../core/appearance';
import { progressKey } from '../../core/readingProgress';
import { LocaleProvider } from '../../i18n/LocaleProvider';

const CARD: ReaderCard = {
  slug: 'indices',
  category: 'estudo',
  categoryLabel: 'Estudo',
  dateLabel: 'FEV 2024',
  title: 'Fundamentos de índices',
  summary: 'Quando um índice ajuda.',
  body: ['## Como o planejador decide', 'Texto.', '### Seletividade', 'Mais texto.', '## Conclusão', 'Fim.'].join('\n\n'),
  appearance: DEFAULT_APPEARANCE,
};

function mount(card: ReaderCard = CARD) {
  return render(
    <LocaleProvider initial="pt">
      <ReaderView overlayRef={createRef<HTMLDivElement>()} card={card} onClose={() => undefined} />
    </LocaleProvider>,
  );
}

describe('ReaderView', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(cleanup);

  it('o sumário lista os intertítulos e aponta para as âncoras do corpo', () => {
    mount();

    const toc = screen.getByRole('navigation', { name: 'Neste artigo' });
    const links = Array.from(toc.querySelectorAll('a'));
    expect(links.map((link) => link.textContent)).toEqual(['Como o planejador decide', 'Seletividade', 'Conclusão']);
    for (const link of links) {
      const id = link.getAttribute('href')?.slice(1) ?? '';
      expect(document.getElementById(id)?.tagName).toMatch(/^H[23]$/);
    }
  });

  it('tempo de leitura e data só no painel; o artigo fica só com o texto', () => {
    mount();
    expect(screen.getAllByText('1 min de leitura')).toHaveLength(1);
    expect(screen.getAllByText('FEV 2024')).toHaveLength(1);
    const article = screen.getByRole('article');
    expect(article.textContent).not.toMatch(/FEV 2024|min de leitura|Estudo/);
  });

  it('oferece continuar de onde parou só no meio do caminho', () => {
    window.localStorage.setItem(progressKey('indices'), '0.42');
    mount();
    expect(screen.getByRole('button', { name: /Continuar de onde parou · 42%/ })).not.toBeNull();
    cleanup();

    window.localStorage.setItem(progressKey('indices'), '0.02');
    mount();
    expect(screen.queryByRole('button', { name: /Continuar de onde parou/ })).toBeNull();
  });

  it('artigo sem intertítulos não desenha sumário vazio', () => {
    mount({ ...CARD, body: 'Só um parágrafo.' });
    expect(screen.queryByRole('navigation', { name: 'Neste artigo' })).toBeNull();
  });
});

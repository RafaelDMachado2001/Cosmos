import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ArticleBody } from './ArticleBody';

/*
 * `ArticleBody` é o único lugar que desenha um bloco — este teste prova que
 * os seis tipos saem com a tag semântica esperada, não a marcação do
 * Markdown. `core/blocks.test.ts` já cobre o parsing em si.
 */
describe('ArticleBody', () => {
  afterEach(() => {
    cleanup();
  });

  it('título de seção sai como h2 ou h3', () => {
    render(<ArticleBody markdown={'## Um título\n\n### Um subtítulo'} />);

    expect(screen.getByRole('heading', { level: 2, name: 'Um título' })).not.toBeNull();
    expect(screen.getByRole('heading', { level: 3, name: 'Um subtítulo' })).not.toBeNull();
  });

  it('parágrafo sai como p, com negrito e itálico preservados', () => {
    render(<ArticleBody markdown="Um **forte** e um *leve*." />);

    const paragraph = screen.getByText((_, element) => element?.tagName === 'P');
    expect(paragraph.querySelector('strong')?.textContent).toBe('forte');
    expect(paragraph.querySelector('em')?.textContent).toBe('leve');
  });

  it('citação sai como blockquote', () => {
    render(<ArticleBody markdown="> Uma citação." />);

    expect(screen.getByText('Uma citação.').closest('blockquote')).not.toBeNull();
  });

  it('lista sem marcador sai como ul, numerada sai como ol', () => {
    const { container } = render(
      <ArticleBody markdown={'- Um\n- Dois\n\n1. Primeiro\n2. Segundo'} />,
    );

    expect(container.querySelectorAll('ul > li')).toHaveLength(2);
    expect(container.querySelectorAll('ol > li')).toHaveLength(2);
  });

  it('bloco de código sai como pre > code, com a linguagem anotada', () => {
    render(<ArticleBody markdown={'```ts\nconst x = 1;\n```'} />);

    const code = screen.getByText('const x = 1;');
    expect(code.tagName).toBe('CODE');
    expect(code.closest('pre')).not.toBeNull();
    expect(screen.getByText('ts')).not.toBeNull();
  });

  it('imagem sai como figure > img, com legenda em figcaption', () => {
    render(<ArticleBody markdown='![um gráfico](https://example.com/a.png "Figura 1")' />);

    const image = screen.getByRole('img', { name: 'um gráfico' });
    expect(image.getAttribute('src')).toBe('https://example.com/a.png');
    expect(image.closest('figure')?.textContent).toContain('Figura 1');
  });

  it('link com protocolo aceito sai como a, com href', () => {
    render(<ArticleBody markdown="[este artigo](https://example.com/a)" />);

    expect(screen.getByRole('link', { name: 'este artigo' }).getAttribute('href')).toBe(
      'https://example.com/a',
    );
  });

  it('link com protocolo recusado não produz elemento clicável', () => {
    render(<ArticleBody markdown="[clique aqui](javascript:alert)" />);

    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('clique aqui')).not.toBeNull();
  });

  it('markdown vazio não desenha nada', () => {
    const { container } = render(<ArticleBody markdown="" />);

    expect(container.textContent).toBe('');
  });
});

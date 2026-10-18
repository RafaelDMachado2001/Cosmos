import { describe, expect, it } from 'vitest';

import { compose } from './compose';
import type { PrerenderedPage } from './pages';

const TEMPLATE = [
  '<!doctype html>',
  '<html lang="pt">',
  '<head>',
  '  <title>RDM Labs</title>',
  '  <meta name="description" content="genérico">',
  '  <script type="module" src="/assets/index-abc.js"></script>',
  '</head>',
  '<body><div id="root"></div><div id="prerender"></div></body>',
  '</html>',
].join('\n');

function page(overrides: Partial<PrerenderedPage> = {}): PrerenderedPage {
  return {
    path: 'pt/publicacoes/x',
    lang: 'pt',
    head: '<title>Artigo</title>',
    body: '<article>texto</article>',
    ...overrides,
  };
}

describe('compose', () => {
  it('troca título, descrição e idioma do template pelos da página', () => {
    const html = compose(TEMPLATE, page({ lang: 'en' }), '.a{}');

    expect(html).toContain('<html lang="en">');
    expect(html).not.toContain('<title>RDM Labs</title>');
    expect(html).not.toContain('genérico');
    expect(html).toContain('<title>Artigo</title>\n<style data-head>.a{}</style>\n</head>');
    expect(html).toContain('<div id="prerender"><article>texto</article></div>');
  });

  it.each(['$&', "$'", '$`', '$1', '$$'])('%s no corpo ou no cabeçalho sai literal', (pattern) => {
    const body = `<article><pre><code>s/x/${pattern}/</code></pre></article>`;
    const head = `<title>Preço em ${pattern}</title>`;
    const html = compose(TEMPLATE, page({ body, head }), `.a::after{content:"${pattern}"}`);

    expect(html).toContain(`<div id="prerender">${body}</div>`);
    expect(html).toContain(head);
    expect(html).toContain(`content:"${pattern}"`);
    // O script do bundle aparece uma vez só: nada do template foi colado no texto.
    expect(html.split('/assets/index-abc.js')).toHaveLength(2);
  });
});

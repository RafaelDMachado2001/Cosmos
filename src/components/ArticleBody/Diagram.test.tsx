import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ArticleBody } from './ArticleBody';
import { REFERENCE_DIAGRAM, REFERENCE_STATES } from '../../core/diagram/fixture';
import { DIAGRAM_LIMITS } from '../../core/diagram/parse';
import { DICTIONARIES } from '../../i18n/dictionaries';
import { LocaleProvider } from '../../i18n/LocaleProvider';

const fence = (source: string): string => ['```diagram', source, '```'].join('\n');

const render = (markdown: string): string => renderToStaticMarkup(<ArticleBody markdown={markdown} />);

describe('ArticleBody com diagrama', () => {
  it('auto desenha dois svg com papel de imagem e sem atributo de fonte', () => {
    const html = render(fence(REFERENCE_DIAGRAM));
    expect(html.match(/<svg[^>]*role="img"/g)).toHaveLength(2);
    expect(html).not.toMatch(/font-size|font-family|fill="|stroke="/);
  });

  it('title, desc e legenda saem do diagrama', () => {
    const html = render(fence(REFERENCE_DIAGRAM));
    expect(html.match(/<title id="[^"]+">O caminho de uma request até o PHP<\/title>/g)).toHaveLength(2);
    expect(html).toContain('Navegador para NGINX: HTTPS.');
    expect(html).toMatch(/<figcaption[^>]*>O caminho de uma request até o PHP<\/figcaption>/);
  });

  it('o mesmo id de diagrama duas vezes não repete ids no documento', () => {
    const html = render([fence(REFERENCE_DIAGRAM), fence(REFERENCE_DIAGRAM)].join('\n\n'));
    const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((match) => match[1]);
    expect(ids).toHaveLength(8);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('aria-labelledby aponta para ids que existem', () => {
    const html = render(fence(REFERENCE_DIAGRAM));
    const ids = new Set([...html.matchAll(/ id="([^"]+)"/g)].map((match) => match[1]));
    for (const match of html.matchAll(/aria-labelledby="([^"]+)"/g)) {
      for (const id of (match[1] ?? '').split(' ')) expect(ids.has(id)).toBe(true);
    }
  });

  it('sem título, não há title nem legenda', () => {
    const html = render(fence('flow f\na "A"\nb "B"\na -> b'));
    expect(html).not.toContain('<title');
    expect(html).not.toContain('figcaption');
    expect(html).toMatch(/aria-labelledby="f-block-0-right-desc"/);
  });

  it('direção fixa desenha um svg só', () => {
    expect(render(fence('flow f\ndirection: right\na "A"')).match(/<svg/g)).toHaveLength(1);
  });

  it('diagrama inválido cai no bloco de código, com a fonte e o rótulo da linguagem', () => {
    const html = render(fence('flow f\na -> b'));
    expect(html).not.toContain('<svg');
    expect(html).toContain('<pre');
    expect(html).toContain('>diagram</span>');
    expect(html).toContain('a -&gt; b');
  });

  it('a descrição acompanha o idioma da página', () => {
    expect(DICTIONARIES.en.diagram.to).toBe('to');
    const html = renderToStaticMarkup(
      <LocaleProvider initial="en">
        <ArticleBody markdown={fence('flow f\na "A"\nb "B"\na -> b : HTTPS')} />
      </LocaleProvider>,
    );
    expect(html).toContain('A to B: HTTPS.');
  });

  it('sem estados não há seletor, painel nem camada', () => {
    const html = render(fence(REFERENCE_DIAGRAM));
    expect(html).not.toMatch(/type="radio"|aria-live|data-state|<circle/);
  });

  it('com estados, a visão geral vem marcada e cada cenário tem camada em cada orientação', () => {
    const html = render(fence(`${REFERENCE_DIAGRAM}${REFERENCE_STATES}`));
    expect(html.match(/type="radio"/g)).toHaveLength(5);
    expect(html).toMatch(/<input[^>]*data-state="0"[^>]*checked=""/);
    expect(html.match(/checked=""/g)).toHaveLength(1);
    expect(html.match(/<g[^>]*data-state="3"/g)).toHaveLength(2);
    expect(html.match(/<circle[^>]*style=/g)).toHaveLength(8);
    expect(html).toMatch(/offset-path:path\(/);
    expect(html).toContain('Bad Gateway');
    expect(html.match(/data-badge="err"/g)).toHaveLength(2);
    expect(html.match(/data-badge="warn"/g)).toHaveLength(2);
  });

  it('dois diagramas iguais não compartilham o grupo de rádio', () => {
    const source = fence(`${REFERENCE_DIAGRAM}${REFERENCE_STATES}`);
    const names = new Set([...render(`${source}\n\n${source}`).matchAll(/name="([^"]+)"/g)].map((match) => match[1]));
    expect(names.size).toBe(2);
  });

  it('o CSS cobre todos os estados que o parser aceita', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/components/ArticleBody/ArticleBody.module.css'), 'utf8');
    for (let state = 1; state <= DIAGRAM_LIMITS.states; state += 1) {
      expect(css).toContain(`.diagramLayer[data-state='${String(state)}']`);
      expect(css).toContain(`[data-touched~='${String(state)}']`);
    }
    expect(css).not.toContain(`[data-state='${String(DIAGRAM_LIMITS.states + 1)}']`);
  });
});

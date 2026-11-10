import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ArticleBody } from './ArticleBody';
import {
  REFERENCE_DIAGRAM,
  REFERENCE_LAYERS,
  REFERENCE_SEQUENCE,
  REFERENCE_SPECTRUM,
  REFERENCE_STATES,
} from '../../core/diagram/fixture';
import { DIAGRAM_LIMITS } from '../../core/diagram/parse';
import { SPECTRUM_LIMITS } from '../../core/diagram/parseSpectrum';
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

describe('ArticleBody com espectro', () => {
  it('desenha zonas e faixas em HTML, com a primeira zona marcada', () => {
    const html = render(fence(REFERENCE_SPECTRUM));
    expect(html).not.toContain('<svg');
    expect(html.match(/type="radio"/g)).toHaveLength(3);
    expect(html.match(/checked=""/g)).toHaveLength(1);
    expect(html).toMatch(/<input[^>]*data-state="1"[^>]*checked=""/);
    expect(html).toContain('grid-template-columns:38fr 28fr 34fr');
    expect(html).toContain('left:24%;width:50%');
  });

  it('o leitor de tela recebe zonas e faixas em texto', () => {
    const html = render(fence(REFERENCE_SPECTRUM));
    expect(html).toContain('Doces, de 24% a 74%.');
  });

  it('cada zona traz o diagnóstico, e a legenda sai do título', () => {
    const html = render(fence(REFERENCE_SPECTRUM));
    expect(html).toContain('Moa um pouco mais grosso');
    expect(html).toMatch(/<figcaption[^>]*>A ordem da extração<\/figcaption>/);
  });

  it('o limite de zonas cabe nas regras de CSS', () => {
    expect(SPECTRUM_LIMITS.zones).toBeLessThanOrEqual(DIAGRAM_LIMITS.states);
  });
});

describe('ArticleBody com sequência', () => {
  it('desenha participantes, linhas de vida e mensagens num svg só', () => {
    const html = render(fence(REFERENCE_SEQUENCE));
    expect(html.match(/<svg[^>]*role="img"/g)).toHaveLength(1);
    expect(html.match(/<line /g)).toHaveLength(3);
    expect(html.match(/<polygon/g)).toHaveLength(4);
    expect(html.match(/data-reply=""/g)).toHaveLength(1);
  });

  it('descreve as mensagens em ordem', () => {
    expect(render(fence(REFERENCE_SEQUENCE))).toContain('4. Worker responde a Fila: confirma.');
  });
});

describe('ArticleBody com camadas', () => {
  const html = render(fence(REFERENCE_LAYERS));

  function element(pattern: RegExp): string {
    const match = pattern.exec(html);
    if (match === null) throw new Error(`não achei ${String(pattern)}`);
    return match[0];
  }

  it('é HTML, com quatro níveis de role="group" na pilha, de depth-1 a depth-4', () => {
    expect(html).not.toContain('<svg');
    for (const depth of [1, 2, 3, 4]) {
      expect(html.match(new RegExp(`role="group"[^>]*class="[^"]*depth-${String(depth)}[_ "]`, 'g'))).toHaveLength(1);
    }
    expect(html).not.toMatch(/depth-5/);
  });

  it('a ordem do HTML é a ordem declarada', () => {
    const order = ['Frontend', 'laravel/framework', 'Pacotes', 'O seu código'].map((text) => html.indexOf(`>${text}<`));
    expect(order.every((position) => position > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('itens em ul/li, um item por pílula', () => {
    expect(html).toContain('>Inertia (React/Vue)</li>');
    expect(html.match(/<li /g)).toHaveLength(43);
  });

  it('o grupo "O seu código" leva a classe de highlight', () => {
    expect(element(/<div class="[^"]*"><span id="[^"]+"[^>]*>O seu código</)).toMatch(/layerHighlight/);
    expect(element(/<div class="[^"]*"><span id="[^"]+"[^>]*>Frontend</)).not.toMatch(/layerHighlight/);
  });

  it('base e aside ficam fora da pilha de camadas', () => {
    const stackEnd = html.indexOf('>A base de tudo<');
    const lastLayerText = html.indexOf('>integrações<');
    expect(stackEnd).toBeGreaterThan(lastLayerText);
    const base = element(/<div role="group" aria-labelledby="[^"]*band-base"[^>]*>/);
    expect(base).not.toMatch(/layer[_ "]/);
    expect(base).toMatch(/layersBase/);
    expect(element(/<div role="group" aria-labelledby="[^"]*band-aside-0"[^>]*>/)).toMatch(/layersAside/);
    expect(html).toMatch(/<figcaption[^>]*>O ecossistema Laravel<\/figcaption>/);
  });

  it('sem style nem font-size', () => {
    expect(html).not.toMatch(/style=|font-size/);
  });

  it('cada grupo aponta para um rótulo que existe, e os ids não se repetem com o diagrama duas vezes', () => {
    const twice = render([fence(REFERENCE_LAYERS), fence(REFERENCE_LAYERS)].join('\n\n'));
    const ids = [...twice.matchAll(/ id="([^"]+)"/g)].map((match) => match[1]);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    for (const match of twice.matchAll(/aria-labelledby="([^"]+)"/g)) expect(ids).toContain(match[1]);
  });
});

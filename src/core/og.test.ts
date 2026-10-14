import { describe, expect, it } from 'vitest';

import { ogImagePath, parseTokens } from './og';
import type { OgCard } from './og';

const CARD: OgCard = {
  locale: 'pt',
  title: 'Code review sem atrito',
  kicker: 'Artigo técnico',
  category: 'artigo',
  date: '2026-01-15',
};

describe('ogImagePath', () => {
  it('mora em /og/, com o idioma no nome e extensao png', () => {
    expect(ogImagePath(CARD)).toMatch(/^\/og\/pt-[0-9a-f]{8}\.png$/);
  });

  it('o mesmo cartao da sempre o mesmo nome: o que nao mudou nao e redesenhado', () => {
    expect(ogImagePath({ ...CARD })).toBe(ogImagePath(CARD));
  });

  it('qualquer coisa desenhada no cartao muda o nome', () => {
    const base = ogImagePath(CARD);
    expect(ogImagePath({ ...CARD, title: 'Outro título' })).not.toBe(base);
    expect(ogImagePath({ ...CARD, locale: 'en' })).not.toBe(base);
    expect(ogImagePath({ ...CARD, kicker: 'Estudo' })).not.toBe(base);
    expect(ogImagePath({ ...CARD, category: 'estudo' })).not.toBe(base);
    expect(ogImagePath({ ...CARD, date: '2026-01-16' })).not.toBe(base);
  });
});

describe('parseTokens', () => {
  it('le as propriedades customizadas, sem comentarios nem espacos', () => {
    const css = `:root {
  --color-bg: #05060b; /* fundo global */
  --color-cat-artigo: #6e7bff;
  --font-sans: 'Roboto', system-ui;
}`;
    expect(parseTokens(css)).toEqual({
      'color-bg': '#05060b',
      'color-cat-artigo': '#6e7bff',
      'font-sans': "'Roboto', system-ui",
    });
  });
});

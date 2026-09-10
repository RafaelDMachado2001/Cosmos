import { describe, expect, it } from 'vitest';

import { makeSyntheticPublications } from './synthetic';
import { PUBLICATIONS } from './publications';
import { TIMELINE, placeStars } from '../core/timeline';
import { LOCALES } from '../core/types';

describe('makeSyntheticPublications', () => {
  it('gera a quantidade pedida', () => {
    expect(makeSyntheticPublications({ count: 200 })).toHaveLength(200);
  });

  it('é determinístico: a mesma semente dá o mesmo acervo', () => {
    const a = makeSyntheticPublications({ count: 50, seed: 7 });
    const b = makeSyntheticPublications({ count: 50, seed: 7 });
    expect(a).toEqual(b);
  });

  it('sementes diferentes dão acervos diferentes', () => {
    const a = makeSyntheticPublications({ count: 50, seed: 1 });
    const b = makeSyntheticPublications({ count: 50, seed: 2 });
    expect(a).not.toEqual(b);
  });

  it('não repete slug nem colide com o acervo real', () => {
    const synthetic = makeSyntheticPublications({ count: 300 });
    const slugs = synthetic.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);

    const real = new Set(PUBLICATIONS.map((p) => p.slug));
    for (const slug of slugs) expect(real.has(slug)).toBe(false);
  });

  it('usa slugs ASCII em formato de URL, como o acervo real', () => {
    for (const publication of makeSyntheticPublications({ count: 100 })) {
      expect(publication.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });

  it('preenche os dois idiomas', () => {
    for (const publication of makeSyntheticPublications({ count: 30 })) {
      for (const locale of LOCALES) {
        expect(publication.content[locale].title.trim()).not.toBe('');
        expect(publication.content[locale].body.length).toBeGreaterThan(0);
      }
    }
  });

  it('respeita o espaçamento mínimo mesmo com centenas de itens', () => {
    // É este conjunto que exercita de fato o passe de espaçamento e a
    // virtualização — com as 14 do protótipo nada disso é testado de verdade.
    const stars = placeStars(makeSyntheticPublications({ count: 300 }));
    for (let i = 1; i < stars.length; i += 1) {
      const gap = (stars[i]?.x ?? 0) - (stars[i - 1]?.x ?? 0);
      expect(gap).toBeGreaterThanOrEqual(TIMELINE.minGapPx - 1e-9);
    }
  });
});

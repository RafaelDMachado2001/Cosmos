import { describe, expect, it } from 'vitest';

import {
  FNV_OFFSET_BASIS,
  TIMELINE,
  fnv1a32,
  hash01,
  layoutHealth,
  placeStars,
  suggestGapPxPerDay,
} from './timeline';
import { makeDataset, makeNewer, makeRandom } from './testing';
import type { PublicationInput } from './types';

/**
 * Vetores fixados. Este é o contrato com a futura implementação em PHP: o
 * mesmo slug precisa produzir o mesmo inteiro dos dois lados, senão as estrelas
 * mudam de altura quando o backend assumir o posicionamento.
 */
const VECTORS: ReadonlyArray<readonly [string, number]> = [
  ['', 2166136261],
  ['pg-idx', 608837166],
  ['n1', 70638592],
  ['logi', 3842169640],
  ['week', 3586561629],
  ['queue', 4108302520],
  ['legacy', 3167593822],
  ['bill', 3142504220],
  ['review', 576156385],
  ['rsc', 1071413859],
  ['rdm', 771137930],
  ['otel', 4245768183],
  ['glsl', 2234369249],
  ['five', 2931049365],
  ['llm', 895062104],
  ['arquitetura-e-orquestracao-de-llms', 1568767337],
];

describe('fnv1a32', () => {
  it.each(VECTORS)('reproduz o vetor fixado de %j', (input, expected) => {
    expect(fnv1a32(input)).toBe(expected);
  });

  it('devolve o offset basis para a string vazia', () => {
    expect(fnv1a32('')).toBe(FNV_OFFSET_BASIS);
  });

  it('opera sobre bytes UTF-8, não sobre code units UTF-16', () => {
    // 'ç' é um code unit em UTF-16 e dois bytes em UTF-8. O protótipo usava
    // charCodeAt; o PHP percorre bytes. Fixar UTF-8 é o que mantém a paridade.
    expect(fnv1a32('ç')).toBe(412999503);
    expect(fnv1a32('índice')).toBe(781077258);
  });

  it('devolve sempre um uint32', () => {
    for (const [input] of VECTORS) {
      const value = fnv1a32(input);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(0xffffffff);
    }
  });
});

describe('hash01', () => {
  it('fica sempre em [0, 1)', () => {
    for (let i = 0; i < 2000; i += 1) {
      const value = hash01(`slug-${i}`);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('é determinístico: o mesmo slug sempre cai no mesmo lugar', () => {
    expect(hash01('arquitetura-e-orquestracao-de-llms')).toBe(
      hash01('arquitetura-e-orquestracao-de-llms'),
    );
  });

  it('separa slugs vizinhos', () => {
    expect(hash01('n1')).not.toBe(hash01('n2'));
  });

  it('quantiza em 10.000 passos, como o protótipo', () => {
    // A forma `% 10000` é mantida porque é a mais barata de reproduzir em PHP.
    expect(hash01('llm')).toBeCloseTo(0.2104, 10);
    expect(hash01('rdm')).toBeCloseTo(0.793, 10);
  });
});

describe('placeStars', () => {
  const at = (slug: string, publishedAt: string): PublicationInput => ({
    slug,
    publishedAt: `${publishedAt}T12:00:00.000Z`,
    category: 'artigo',
  });

  it('devolve vazio para conjunto vazio', () => {
    expect(placeStars([])).toEqual([]);
  });

  it('coloca um item só exatamente na posição da data', () => {
    const [star] = placeStars([at('a', '2024-06-01')]);
    expect(star?.x).toBe(star?.dateX);
    expect(star?.pushPx).toBe(0);
  });

  it('nunca coloca uma estrela à esquerda da sua data', () => {
    const stars = placeStars(makeDataset(makeRandom(7), { count: 120, spanDays: 400 }));
    for (const star of stars) expect(star.x).toBeGreaterThanOrEqual(star.dateX);
  });

  it('mantém o espaçamento mínimo entre estrelas consecutivas', () => {
    const stars = placeStars(makeDataset(makeRandom(11), { count: 200, spanDays: 300 }));
    for (let i = 1; i < stars.length; i += 1) {
      const gap = (stars[i]?.x ?? 0) - (stars[i - 1]?.x ?? 0);
      expect(gap).toBeGreaterThanOrEqual(TIMELINE.minGapPx - 1e-9);
    }
  });

  it('marca ponto de reset exatamente onde não houve empurrão', () => {
    const stars = placeStars(makeDataset(makeRandom(3), { count: 80, spanDays: 200 }));
    for (const star of stars) {
      expect(star.pushPx === 0).toBe(star.x === star.dateX);
    }
  });

  it('não empurra ninguém quando as datas são esparsas', () => {
    // Com gap 3.4 px/dia e minGap 34px, 10 dias já bastam para nunca colidir.
    const items = Array.from({ length: 40 }, (_, i) =>
      at(`sparse-${i}`, new Date(Date.UTC(2024, 0, 1 + i * 30)).toISOString().slice(0, 10)),
    );
    const stars = placeStars(items);
    for (const star of stars) expect(star.pushPx).toBe(0);
    expect(layoutHealth(stars).pushedRatio).toBe(0);
  });

  it('independe da ordem de entrada', () => {
    const items = makeDataset(makeRandom(23), { count: 60, spanDays: 500 });
    const shuffled = [...items].reverse();
    expect(placeStars(shuffled)).toEqual(placeStars(items));
  });

  it('separa publicações do mesmo instante por slug, na distância mínima', () => {
    const same = '2025-03-04T10:00:00.000Z';
    const stars = placeStars([
      { slug: 'zebra', publishedAt: same, category: 'artigo' },
      { slug: 'abelha', publishedAt: same, category: 'estudo' },
    ]);
    expect(stars.map((s) => s.slug)).toEqual(['abelha', 'zebra']);
    expect((stars[1]?.x ?? 0) - (stars[0]?.x ?? 0)).toBeCloseTo(TIMELINE.minGapPx, 9);
  });

  it('publicar um item novo não move nenhum existente', () => {
    // A garantia dura do handoff. Property test: 200 conjuntos aleatórios.
    const random = makeRandom(99);
    for (let round = 0; round < 200; round += 1) {
      const items = makeDataset(random, {
        count: 2 + Math.floor(random() * 40),
        spanDays: 1 + Math.floor(random() * 900),
      });
      const before = placeStars(items).map((s) => s.x);
      const after = placeStars([...items, makeNewer(items, 'novissimo')]).map((s) => s.x);
      expect(after.slice(0, before.length)).toEqual(before);
    }
  });

  it('mantém o prefixo intacto ao longo de 50 publicações seguidas', () => {
    let items = makeDataset(makeRandom(5), { count: 10, spanDays: 120 });
    let previous = placeStars(items).map((s) => s.x);
    for (let i = 0; i < 50; i += 1) {
      items = [...items, makeNewer(items, `append-${i}`)];
      const current = placeStars(items).map((s) => s.x);
      expect(current.slice(0, previous.length)).toEqual(previous);
      previous = current;
    }
  });

  it('publicação retroativa só empurra para a direita, e só até o próximo reset', () => {
    const items = makeDataset(makeRandom(41), { count: 60, spanDays: 120 });
    const before = placeStars(items);
    const inserted: PublicationInput = {
      slug: 'retroativa',
      publishedAt: before[20]?.timestamp
        ? new Date((before[20]?.timestamp ?? 0) + 3600000).toISOString()
        : '2024-02-01T00:00:00.000Z',
      category: 'rotina',
    };
    const after = placeStars([...items, inserted]);
    const byslug = new Map(after.map((s) => [s.slug, s]));

    for (const star of before) {
      expect(byslug.get(star.slug)?.x ?? 0).toBeGreaterThanOrEqual(star.x);
    }

    // A perturbação morre no primeiro ponto de reset depois da inserção.
    const insertedIndex = after.findIndex((s) => s.slug === 'retroativa');
    const reset = after.findIndex((s, i) => i > insertedIndex && s.pushPx === 0);
    if (reset !== -1) {
      for (const star of after.slice(reset)) {
        const original = before.find((s) => s.slug === star.slug);
        if (original) expect(star.x).toBe(original.x);
      }
    }
  });

  it('o recorte por janela só bate quando o corte cai num ponto de reset', () => {
    // Documenta a restrição que a paginação por `before=` precisa respeitar.
    // O recorte sai da ordem POSICIONADA, não da ordem de entrada: com muitas
    // datas repetidas as duas divergem, e o teste ficaria intermitente.
    // Conjunto folgado de propósito: num acervo denso não existe reset, e
    // aí a paginação por janela simplesmente não é recortável.
    const items = makeDataset(makeRandom(67), { count: 60, spanDays: 1500 });
    const all = placeStars(items);
    const asInput = (star: (typeof all)[number]): PublicationInput => ({
      slug: star.slug,
      publishedAt: new Date(star.timestamp).toISOString(),
      category: star.category,
    });

    const cut = all.findIndex((s, i) => i > 10 && s.pushPx === 0);
    expect(cut).toBeGreaterThan(0);

    const fromReset = placeStars(all.slice(cut).map(asInput));
    expect(fromReset.map((s) => s.x)).toEqual(all.slice(cut).map((s) => s.x));

    const pushed = all.findIndex((s, i) => i > cut && s.pushPx > 0);
    if (pushed !== -1) {
      const fromPushed = placeStars(all.slice(pushed).map(asInput));
      expect(fromPushed[0]?.x).not.toBe(all[pushed]?.x);
    }
  });
});

describe('layoutHealth', () => {
  it('acusa quando o gap fixado ficou apertado demais', () => {
    // É este teste que transforma "retunar o gap" num commit explícito em vez
    // de algo que acontece sozinho sob o cursor do leitor.
    const denso = placeStars(makeDataset(makeRandom(13), { count: 400, spanDays: 90 }));
    const health = layoutHealth(denso);
    expect(health.pushedRatio).toBeGreaterThan(0.05);
    expect(health.minSpacingPx).toBeGreaterThanOrEqual(TIMELINE.minGapPx - 1e-9);
  });

  it('reporta zero empurrão e largura coerente num conjunto folgado', () => {
    // Espaçamento garantido, não sorteado: 20 datas aleatórias em 900 dias
    // colidem por aniversário e o conjunto deixaria de ser folgado.
    const folgado = placeStars(
      Array.from({ length: 20 }, (_, i) => ({
        slug: `folgado-${i}`,
        publishedAt: new Date(Date.UTC(2024, 0, 1 + i * 30)).toISOString(),
        category: 'estudo' as const,
      })),
    );
    const health = layoutHealth(folgado);
    expect(health.pushedCount).toBe(0);
    expect(health.pushedRatio).toBe(0);
    expect(health.widthPx).toBeGreaterThan(0);
  });

  it('devolve valores neutros para conjunto vazio', () => {
    expect(layoutHealth([])).toEqual({
      widthPx: 0,
      minSpacingPx: Number.POSITIVE_INFINITY,
      medianSpacingPx: 0,
      pushedCount: 0,
      pushedRatio: 0,
    });
  });
});

describe('suggestGapPxPerDay', () => {
  it('cresce com a densidade', () => {
    const random = makeRandom(29);
    const esparso = suggestGapPxPerDay(makeDataset(random, { count: 20, spanDays: 900 }));
    const denso = suggestGapPxPerDay(makeDataset(random, { count: 400, spanDays: 900 }));
    expect(denso).toBeGreaterThan(esparso);
  });

  it('é apenas consultiva: placeStars ignora o tamanho do conjunto', () => {
    // Este é o teste que impede alguém de religar a adaptividade no runtime.
    // Se placeStars passar a derivar o gap do conjunto, ele quebra na hora.
    const data = '2025-05-05T00:00:00.000Z';
    const alvo: PublicationInput = { slug: 'alvo', publishedAt: data, category: 'artigo' };

    const sozinho = placeStars([alvo]);
    const acompanhado = placeStars([
      alvo,
      ...makeDataset(makeRandom(31), { count: 300, spanDays: 900 }),
    ]);

    const encontrado = acompanhado.find((s) => s.slug === 'alvo');
    expect(encontrado?.dateX).toBe(sozinho[0]?.dateX);
  });
});

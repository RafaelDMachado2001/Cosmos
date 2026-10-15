import { describe, expect, it } from 'vitest';

import {
  CAPTION_BELOW_PX,
  connectors,
  monthMarkers,
  panBounds,
  panBucket,
  panForStar,
  resolveBand,
  strandExtent,
  visibleRange,
  xAtTime,
  yPx,
  yearAtCenter,
  yearMarkers,
} from './geometry';
import { hash01 } from './hash';
import { TIMELINE, placeStars } from './timeline';
import { makeDataset, makeRandom } from './testing';
import type { PublicationInput, Viewport } from './types';

const HEADER_PX = 76;
const RULER_PX = 58;

const view = (width: number, height: number): Viewport => ({
  width,
  height,
  headerPx: HEADER_PX,
  rulerPx: RULER_PX,
});

/** Datas espaçadas: sem empates, para xAtTime não ficar ambíguo. */
function spaced(count: number, everyDays = 40): PublicationInput[] {
  return Array.from({ length: count }, (_, i) => ({
    slug: `pub-${i}`,
    publishedAt: new Date(Date.UTC(2024, 0, 1 + i * everyDays)).toISOString(),
    category: 'artigo' as const,
  }));
}

describe('resolveBand', () => {
  it('nunca invade o header nem a régua, de 360 a 2000px de altura', () => {
    // As duas colisões reais do protótipo: a faixa fixa de 30–80% cobria a
    // régua em telas baixas.
    for (let height = 360; height <= 2000; height += 20) {
      const band = resolveBand(view(1280, height));
      expect(band.topPx).toBeGreaterThanOrEqual(HEADER_PX + 24);
      // E o rótulo sob a estrela mais baixa também cabe acima da régua.
      expect(band.bottomPx + CAPTION_BELOW_PX).toBeLessThanOrEqual(height - RULER_PX - 24);
      expect(band.bottomPx).toBeGreaterThanOrEqual(band.topPx);
    }
  });

  it('limita a dispersão em torno do eixo nas telas altas', () => {
    // Sem o limite, uma tela de 2000px espalharia as estrelas por 1800px e a
    // constelação deixaria de se ler como uma faixa.
    const band = resolveBand(view(1280, 2000));
    expect(band.bottomPx - band.topPx).toBeLessThanOrEqual(2000 * 0.5 + 1);
  });
});

describe('yPx', () => {
  it('mantém toda estrela dentro da banda', () => {
    const stars = placeStars(makeDataset(makeRandom(2), { count: 150, spanDays: 900 }));
    for (const height of [400, 720, 1080, 1600]) {
      const band = resolveBand(view(1280, height));
      for (const star of stars) {
        const y = yPx(star, band);
        expect(y).toBeGreaterThanOrEqual(band.topPx);
        expect(y).toBeLessThanOrEqual(band.bottomPx);
      }
    }
  });

  it('a altura relativa não depende do viewport', () => {
    const [star] = placeStars(spaced(1));
    expect(star?.y01).toBe(hash01('pub-0'));
  });

  it('publicar não muda a altura de ninguém', () => {
    const before = placeStars(spaced(10));
    const after = placeStars([
      ...spaced(10),
      { slug: 'novo', publishedAt: '2030-01-01T00:00:00.000Z', category: 'rotina' },
    ]);
    for (const star of before) {
      expect(after.find((s) => s.slug === star.slug)?.y01).toBe(star.y01);
    }
  });
});

describe('connectors', () => {
  const band = resolveBand(view(1280, 900));

  it('não liga nada com menos de duas estrelas', () => {
    expect(connectors([], band)).toEqual([]);
    expect(connectors(placeStars(spaced(1)), band)).toEqual([]);
  });

  it('produz exatamente n-1 segmentos, entre estrelas consecutivas', () => {
    const stars = placeStars(spaced(12));
    const links = connectors(stars, band);
    expect(links).toHaveLength(stars.length - 1);
    for (const [i, link] of links.entries()) {
      expect(link.fromSlug).toBe(stars[i]?.slug);
      expect(link.toSlug).toBe(stars[i + 1]?.slug);
    }
  });

  it('calcula ângulo em pixels reais, não em pontos percentuais', () => {
    // O protótipo aproximava 1% da altura como 6px, o que só vale num viewport
    // de 600px. Em duas alturas diferentes os ângulos têm de divergir.
    const stars = placeStars(spaced(8));
    const baixa = connectors(stars, resolveBand(view(1280, 600)));
    const alta = connectors(stars, resolveBand(view(1280, 1600)));
    const diferentes = baixa.filter((link, i) => link.angleDeg !== alta[i]?.angleDeg);
    expect(diferentes.length).toBeGreaterThan(0);
  });

  it('comprimento e ângulo batem com hypot e atan2', () => {
    const stars = placeStars(spaced(6));
    const links = connectors(stars, band);
    for (const [i, link] of links.entries()) {
      const a = stars[i];
      const b = stars[i + 1];
      if (!a || !b) throw new Error('conjunto inconsistente');
      const dx = b.x - a.x;
      const dy = yPx(b, band) - yPx(a, band);
      expect(link.x).toBe(a.x);
      expect(link.y).toBe(yPx(a, band));
      expect(link.lengthPx).toBeCloseTo(Math.hypot(dx, dy), 9);
      expect(link.angleDeg).toBeCloseTo((Math.atan2(dy, dx) * 180) / Math.PI, 9);
    }
  });
});

describe('xAtTime', () => {
  it('devolve exatamente o x da estrela na data dela', () => {
    const stars = placeStars(spaced(15));
    for (const star of stars) {
      expect(xAtTime(stars, star.timestamp)).toBeCloseTo(star.x, 9);
    }
  });

  it('é monótona crescente', () => {
    const stars = placeStars(spaced(15));
    const start = (stars[0]?.timestamp ?? 0) - 400 * 86400000;
    const end = (stars[stars.length - 1]?.timestamp ?? 0) + 400 * 86400000;
    let previous = Number.NEGATIVE_INFINITY;
    for (let t = start; t <= end; t += 5 * 86400000) {
      const x = xAtTime(stars, t);
      expect(x).toBeGreaterThanOrEqual(previous);
      previous = x;
    }
  });

  it('cai na origem quando não há estrela alguma', () => {
    expect(xAtTime([], Date.UTC(2025, 0, 1))).toBe(TIMELINE.originX);
  });
});

describe('yearMarkers', () => {
  it('deriva os anos do intervalo real, não de uma faixa fixa', () => {
    const stars = placeStars([
      { slug: 'velho', publishedAt: '2019-03-02T00:00:00.000Z', category: 'artigo' },
      { slug: 'novo', publishedAt: '2031-11-20T00:00:00.000Z', category: 'artigo' },
    ]);
    expect(yearMarkers(stars).map((m) => m.year)).toEqual([
      2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031,
    ]);
  });

  it('devolve vazio sem estrelas e um marcador com uma só', () => {
    expect(yearMarkers([])).toEqual([]);
    expect(yearMarkers(placeStars(spaced(1)))).toHaveLength(1);
  });

  it('posiciona o marcador no espaço já empurrado', () => {
    // Com dateX puro o rótulo se descolaria das estrelas em região comprimida.
    const stars = placeStars(makeDataset(makeRandom(53), { count: 200, spanDays: 200 }));
    for (const marker of yearMarkers(stars)) {
      expect(marker.x).toBeCloseTo(xAtTime(stars, Date.UTC(marker.year, 0, 1)), 9);
    }
  });
});

describe('monthMarkers', () => {
  it('marca todo mês de janeiro do primeiro ano até o mês da mais recente', () => {
    const stars = placeStars([
      { slug: 'a', publishedAt: '2024-03-10T12:00:00.000Z', category: 'artigo' },
      { slug: 'b', publishedAt: '2025-02-01T12:00:00.000Z', category: 'artigo' },
    ]);
    const months = monthMarkers(stars);

    expect(months).toHaveLength(14);
    expect(months[0]).toMatchObject({ year: 2024, month: 0, january: true, hasPublication: false });
    expect(months.at(-1)).toMatchObject({ year: 2025, month: 1, hasPublication: true });
    expect(months.filter((m) => m.january).map((m) => m.year)).toEqual([2024, 2025]);
    expect(months.filter((m) => m.hasPublication).map((m) => m.key)).toEqual([
      '2024-03',
      '2025-02',
    ]);
  });

  it('usa UTC: o mês de uma publicação não muda com o fuso de quem lê', () => {
    // 23h do dia 31 em UTC-3 já é dia 1 em UTC; o que vale é o UTC.
    const stars = placeStars([
      { slug: 'virada', publishedAt: '2024-04-01T02:00:00.000Z', category: 'artigo' },
    ]);
    expect(monthMarkers(stars).filter((m) => m.hasPublication).map((m) => m.key)).toEqual([
      '2024-04',
    ]);
  });

  it('posiciona no espaço já empurrado, como os anos', () => {
    const stars = placeStars(makeDataset(makeRandom(53), { count: 200, spanDays: 200 }));
    for (const marker of monthMarkers(stars)) {
      expect(marker.x).toBeCloseTo(xAtTime(stars, Date.UTC(marker.year, marker.month, 1)), 9);
    }
    expect(monthMarkers([])).toEqual([]);
  });
});

describe('visibleRange', () => {
  it('bate com o filtro por força bruta', () => {
    const random = makeRandom(71);
    const stars = placeStars(makeDataset(random, { count: 300, spanDays: 1200 }));
    const xs = stars.map((s) => s.x);
    const margin = 1920;

    for (let round = 0; round < 500; round += 1) {
      const pan = random() * 12000 - 2000;
      const vw = 320 + random() * 1600;
      const { start, end } = visibleRange(xs, pan, vw, margin);

      const bruteForce: number[] = [];
      for (const [i, x] of xs.entries()) {
        if (x >= pan - margin && x <= pan + vw + margin) bruteForce.push(i);
      }

      expect(start).toBeLessThanOrEqual(end);
      expect(Array.from({ length: end - start }, (_, k) => start + k)).toEqual(bruteForce);
    }
  });

  it('devolve janela vazia quando o pan está fora do conjunto', () => {
    const xs = placeStars(spaced(10)).map((s) => s.x);
    const { start, end } = visibleRange(xs, 900000, 1280, 100);
    expect(end - start).toBe(0);
  });

  it('não perde nada num conjunto vazio', () => {
    expect(visibleRange([], 0, 1280, 100)).toEqual({ start: 0, end: 0 });
  });
});

describe('panBucket', () => {
  it('muda no máximo uma vez a cada bucket percorrido', () => {
    const bucket = 512;
    let changes = 0;
    let previous = panBucket(0, bucket);
    for (let pan = 0; pan <= 5120; pan += 1) {
      const current = panBucket(pan, bucket);
      if (current !== previous) changes += 1;
      previous = current;
    }
    expect(changes).toBe(10);
  });
});

describe('panBounds e panForStar', () => {
  it('mantém o alvo dentro dos limites e alcança a primeira e a última', () => {
    const stars = placeStars(spaced(30));
    const vw = 1280;
    const bounds = panBounds(stars, vw);
    expect(bounds.max).toBeGreaterThanOrEqual(bounds.min);

    for (const star of stars) {
      const pan = panForStar(stars, star, vw);
      expect(pan).toBeGreaterThanOrEqual(bounds.min);
      expect(pan).toBeLessThanOrEqual(bounds.max);
    }
  });

  it('a faixa cobre a última estrela mais a folga', () => {
    const stars = placeStars(spaced(30));
    const extent = strandExtent(stars);
    expect(extent.maxX).toBeCloseTo((stars[stars.length - 1]?.x ?? 0) + TIMELINE.trailingPadPx, 9);
    expect(extent.widthPx).toBe(extent.maxX - extent.minX);
  });
});

describe('yearAtCenter', () => {
  const STARS = placeStars([
    { slug: 'a', publishedAt: '2024-02-10T12:00:00.000Z', category: 'artigo' },
    { slug: 'b', publishedAt: '2025-05-20T12:00:00.000Z', category: 'estudo' },
    { slug: 'c', publishedAt: '2026-01-05T12:00:00.000Z', category: 'projeto' },
  ]);

  it('devolve o ano da estrela mais próxima do centro', () => {
    for (const star of STARS) {
      const year = new Date(star.timestamp).getUTCFullYear();
      expect(yearAtCenter(STARS, star.x)).toBe(year);
    }
  });

  it('não sai do acervo nas pontas', () => {
    expect(yearAtCenter(STARS, -100000)).toBe(2024);
    expect(yearAtCenter(STARS, 100000)).toBe(2026);
  });

  it('num acervo vazio não há ano nenhum', () => {
    expect(yearAtCenter([], 0)).toBeNull();
  });
});

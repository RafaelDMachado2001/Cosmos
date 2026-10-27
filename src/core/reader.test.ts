import { describe, expect, it } from 'vitest';

import {
  CLOSED,
  HOVER_DOCK_BELOW_PX,
  HOVER_FLIP_PX,
  asideCenterX,
  close,
  hoverDocked,
  hoverSide,
  isMounted,
  landed,
  mounted,
  open,
  settled,
  timelineLabel,
  timelinePosition,
  zoomBlurPx,
  zoomDim,
  zoomPush,
  zoomScale,
  zoomTarget,
} from './reader';
import { placeStars } from './timeline';
import type { PublicationInput } from './types';

const ORIGIN_PAN = 1840;

/** Catorze publicações em dias consecutivos, como o acervo semente. */
const ITEMS: readonly PublicationInput[] = Array.from({ length: 14 }, (_, i) => ({
  slug: `pub-${i}`,
  publishedAt: new Date(Date.UTC(2025, 0, 1 + i)).toISOString(),
  category: 'artigo' as const,
}));

const STARS = placeStars(ITEMS);

describe('máquina de estados do leitor', () => {
  it('abrir guarda o slug e o pan de onde a câmera saiu', () => {
    const state = open(CLOSED, 'nebulosa', ORIGIN_PAN);

    expect(state.phase).toBe('opening');
    expect(state.slug).toBe('nebulosa');
    expect(state.originPan).toBe(ORIGIN_PAN);
  });

  it('a vista só é montada depois do avanço da câmera', () => {
    const opening = open(CLOSED, 'nebulosa', ORIGIN_PAN);
    expect(isMounted(opening)).toBe(false);

    const state = mounted(opening);
    expect(state.phase).toBe('open');
    expect(isMounted(state)).toBe(true);
    expect(state.slug).toBe('nebulosa');
    expect(state.originPan).toBe(ORIGIN_PAN);
  });

  it('fechar preserva slug e origem enquanto a vista desaparece', () => {
    const state = close(mounted(open(CLOSED, 'nebulosa', ORIGIN_PAN)));

    expect(state.phase).toBe('closing');
    expect(state.slug).toBe('nebulosa');
    expect(state.originPan).toBe(ORIGIN_PAN);
    // Continua no DOM: desmontar aqui cortaria o fade pela metade.
    expect(isMounted(state)).toBe(true);
  });

  it('assentar volta ao estado fechado e esquece a origem', () => {
    const state = settled(close(mounted(open(CLOSED, 'nebulosa', ORIGIN_PAN))));

    expect(state).toEqual(CLOSED);
    expect(isMounted(state)).toBe(false);
  });

  it('fechar durante a abertura interrompe sem nunca montar a vista', () => {
    // Nada foi ao DOM nesses 760ms, então não há fade de saída a esperar: a
    // câmera simplesmente recua e o leitor volta ao repouso no mesmo passo.
    expect(close(open(CLOSED, 'nebulosa', ORIGIN_PAN))).toEqual(CLOSED);
  });

  it('abrir com a vista já aberta não troca o pan de origem', () => {
    // A constelação está coberta pelo overlay: não há de onde clicar outra
    // estrela. Se acontecer, perder a origem faria a câmera voltar ao lugar
    // errado no fechamento.
    const opened = mounted(open(CLOSED, 'nebulosa', ORIGIN_PAN));
    const state = open(opened, 'quasar', 99);

    expect(state).toEqual(opened);
  });

  it('montar e assentar fora da fase correspondente não fazem nada', () => {
    expect(mounted(CLOSED)).toEqual(CLOSED);
    expect(settled(CLOSED)).toEqual(CLOSED);

    const opened = mounted(open(CLOSED, 'nebulosa', ORIGIN_PAN));
    expect(settled(opened)).toEqual(opened);
  });

  it('fechar o que já está fechado não faz nada', () => {
    expect(close(CLOSED)).toEqual(CLOSED);
  });

  it('reabrir depois de assentar guarda a nova origem', () => {
    const reopened = open(
      settled(close(mounted(open(CLOSED, 'nebulosa', ORIGIN_PAN)))),
      'quasar',
      640,
    );

    expect(reopened.slug).toBe('quasar');
    expect(reopened.originPan).toBe(640);
  });
});

describe('zoomTarget', () => {
  it('avança enquanto abre e enquanto está aberto', () => {
    const opening = open(CLOSED, 'nebulosa', ORIGIN_PAN);
    expect(zoomTarget(opening)).toBe(1);
    expect(zoomTarget(mounted(opening))).toBe(1);
  });

  it('recua ao fechar e com a vista fechada', () => {
    expect(zoomTarget(close(mounted(open(CLOSED, 'nebulosa', ORIGIN_PAN))))).toBe(0);
    expect(zoomTarget(CLOSED)).toBe(0);
  });
});

describe('hoverSide', () => {
  it('âncora à direita da estrela quando há espaço', () => {
    expect(hoverSide(400, 1440)).toBe('right');
  });

  it('inverte para a esquerda perto da borda direita', () => {
    expect(hoverSide(1440 - HOVER_FLIP_PX + 1, 1440)).toBe('left');
  });

  it('exatamente no limite ainda cabe à direita', () => {
    expect(hoverSide(1440 - HOVER_FLIP_PX, 1440)).toBe('right');
  });

  it('fora do encaixe, um dos lados sempre guarda 24px da borda', () => {
    // Recuo + largura do cartão: o que ele ocupa a partir da estrela.
    const reach = 58 + 330;
    for (let width = HOVER_DOCK_BELOW_PX; width <= 2560; width += 37) {
      for (let x = 0; x <= width; x += 11) {
        const side = hoverSide(x, width);
        if (side === 'right') expect(x + reach).toBeLessThanOrEqual(width - 24);
        else expect(x - reach).toBeGreaterThanOrEqual(24);
      }
    }
  });
});

describe('hoverDocked', () => {
  it('encaixa o cartão no tablet e no celular, nunca no desktop', () => {
    expect(hoverDocked(390)).toBe(true);
    expect(hoverDocked(768)).toBe(true);
    expect(hoverDocked(1024)).toBe(false);
    expect(hoverDocked(1440)).toBe(false);
  });
});

describe('timelinePosition', () => {
  it('conta a partir da publicação mais antiga, que é a da esquerda', () => {
    expect(timelinePosition('pub-2', STARS)).toEqual({ position: 3, total: 14 });
  });

  it('a mais recente fecha a contagem', () => {
    expect(timelinePosition('pub-13', STARS)).toEqual({ position: 14, total: 14 });
  });

  it('slug desconhecido não tem posição', () => {
    expect(timelinePosition('inexistente', STARS)).toBeNull();
  });
});

describe('geometria do avanço da câmera', () => {
  it('no desktop a estrela vai ao centro da coluna de 25%', () => {
    expect(asideCenterX(1440)).toBe(180);
  });

  it('no mobile não há coluna: o alvo é o meio da tela', () => {
    expect(asideCenterX(600)).toBe(300);
  });

  it('exatamente em 780px já vale a coluna do desktop', () => {
    expect(asideCenterX(780)).toBe(97.5);
  });

  it('com a câmera parada nada é empurrado', () => {
    expect(zoomPush(720, 1440, 0)).toBe(0);
  });

  it('com a câmera avançada a estrela chega à coluna', () => {
    // A estrela está em 720 e precisa terminar em 180: empurra 540.
    expect(zoomPush(720, 1440, 1)).toBe(540);
  });

  it('o empurrão acompanha o avanço, para o movimento ser um só', () => {
    expect(zoomPush(720, 1440, 0.5)).toBe(270);
  });

  it('uma estrela já à esquerda da coluna é puxada de volta', () => {
    expect(zoomPush(100, 1440, 1)).toBe(-80);
  });

  it('a constelação cresce de 1 a 2.35', () => {
    expect(zoomScale(0)).toBe(1);
    expect(zoomScale(1)).toBeCloseTo(2.35);
  });

  it('o desfoque vai de nenhum a 3px', () => {
    expect(zoomBlurPx(0)).toBe(0);
    expect(zoomBlurPx(1)).toBe(3);
  });

  it('a opacidade da constelação cai para os 28% do handoff', () => {
    expect(zoomDim(0)).toBe(1);
    expect(zoomDim(1)).toBeCloseTo(0.28);
  });
});

describe('timelineLabel', () => {
  it('junta posição e data como a coluna da estrela mostra', () => {
    const position = timelinePosition('pub-2', STARS);
    expect(position).not.toBeNull();
    expect(timelineLabel(position!, 'MAI 2025')).toBe('3 / 14  ·  MAI 2025');
  });
});

describe('landed', () => {
  it('nasce aberta, sem os três tempos da abertura', () => {
    expect(landed(CLOSED, 'code-review-sem-atrito')).toEqual({
      phase: 'open',
      slug: 'code-review-sem-atrito',
      originPan: null,
    });
  });

  it('já está no DOM', () => {
    expect(isMounted(landed(CLOSED, 'x'))).toBe(true);
  });

  it('fecha como qualquer outra', () => {
    expect(close(landed(CLOSED, 'x')).phase).toBe('closing');
  });

  it('não atropela uma vista já aberta', () => {
    const open = landed(CLOSED, 'primeira');
    expect(landed(open, 'segunda')).toBe(open);
  });
});

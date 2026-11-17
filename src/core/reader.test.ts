import { describe, expect, it } from 'vitest';

import {
  CLOSED,
  HOVER_DOCK_BELOW_PX,
  HOVER_FLIP_PX,
  close,
  hoverDocked,
  hoverSide,
  isMounted,
  landed,
  open,
  settled,
  timelineLabel,
  timelinePosition,
  veilDim,
  veilTarget,
} from './reader';
import { placeStars } from './timeline';
import type { PublicationInput } from './types';

const ORIGIN_PAN = 1840;

const ITEMS: readonly PublicationInput[] = Array.from({ length: 14 }, (_, i) => ({
  slug: `pub-${i}`,
  publishedAt: new Date(Date.UTC(2025, 0, 1 + i)).toISOString(),
  category: 'artigo' as const,
}));

const STARS = placeStars(ITEMS);

describe('máquina de estados do leitor', () => {
  it('abrir monta a vista na hora e guarda o pan de onde se saiu', () => {
    const state = open(CLOSED, 'nebulosa', ORIGIN_PAN);

    expect(state.phase).toBe('open');
    expect(state.slug).toBe('nebulosa');
    expect(state.originPan).toBe(ORIGIN_PAN);
    expect(isMounted(state)).toBe(true);
  });

  it('fechar preserva slug e origem enquanto a vista desaparece', () => {
    const state = close(open(CLOSED, 'nebulosa', ORIGIN_PAN));

    expect(state.phase).toBe('closing');
    expect(state.slug).toBe('nebulosa');
    expect(state.originPan).toBe(ORIGIN_PAN);
    expect(isMounted(state)).toBe(true);
  });

  it('assentar volta ao estado fechado e esquece a origem', () => {
    const state = settled(close(open(CLOSED, 'nebulosa', ORIGIN_PAN)));

    expect(state).toEqual(CLOSED);
    expect(isMounted(state)).toBe(false);
  });

  it('abrir com a vista já aberta não troca o pan de origem', () => {
    const opened = open(CLOSED, 'nebulosa', ORIGIN_PAN);
    expect(open(opened, 'quasar', 99)).toBe(opened);
  });

  it('assentar fora do fechamento não faz nada', () => {
    expect(settled(CLOSED)).toEqual(CLOSED);
    const opened = open(CLOSED, 'nebulosa', ORIGIN_PAN);
    expect(settled(opened)).toBe(opened);
  });

  it('fechar o que já está fechado não faz nada', () => {
    expect(close(CLOSED)).toEqual(CLOSED);
  });

  it('reabrir durante o fechamento troca de artigo e guarda a nova origem', () => {
    const reopened = open(close(open(CLOSED, 'nebulosa', ORIGIN_PAN)), 'quasar', 640);

    expect(reopened).toEqual({ phase: 'open', slug: 'quasar', originPan: 640 });
  });
});

describe('veilTarget', () => {
  it('escurece a constelação só com a vista aberta', () => {
    const opened = open(CLOSED, 'nebulosa', ORIGIN_PAN);
    expect(veilTarget(opened)).toBe(1);
    expect(veilTarget(close(opened))).toBe(0);
    expect(veilTarget(CLOSED)).toBe(0);
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

describe('veilDim', () => {
  it('a opacidade da constelação cai para os 28% do handoff', () => {
    expect(veilDim(0)).toBe(1);
    expect(veilDim(1)).toBeCloseTo(0.28);
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

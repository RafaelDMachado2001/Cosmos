import { describe, expect, it } from 'vitest';

import {
  COSMOS_PHASE_ENTER,
  INPUT,
  cameraZ,
  coreAmp,
  coreOpacity,
  coreScale,
  cosmosReveal,
  dominantAxisDelta,
  heroFade,
  keyToDelta,
  needsSlide,
  panToScrubFraction,
  scrubToPan,
  innerGlow,
  phaseFor,
  push,
} from './navigation';
import type { NavState } from './navigation';

const BOUNDS = { min: 0, max: 4000 };
const AT_START: NavState = { enter: 0, pan: 0 };
const AT_COSMOS: NavState = { enter: 1, pan: 0 };

describe('push', () => {
  it('avançando antes do portal, só o enter se move', () => {
    const next = push(AT_START, 300, BOUNDS);
    expect(next.enter).toBeCloseTo(300 * INPUT.enterGain, 12);
    expect(next.pan).toBe(0);
  });

  it('avançando depois do portal, só o pan se move', () => {
    const next = push(AT_COSMOS, 300, BOUNDS);
    expect(next.enter).toBe(1);
    expect(next.pan).toBeCloseTo(300 * INPUT.panGain, 12);
  });

  it('recuando com pan acumulado, o portal fica onde está', () => {
    const next = push({ enter: 1, pan: 900 }, -300, BOUNDS);
    expect(next.enter).toBe(1);
    expect(next.pan).toBeCloseTo(900 - 300 * INPUT.panGain, 12);
  });

  it('recuando com o pan zerado, o portal retrocede', () => {
    const next = push(AT_COSMOS, -300, BOUNDS);
    expect(next.pan).toBe(0);
    expect(next.enter).toBeCloseTo(1 - 300 * INPUT.enterGain, 12);
  });

  it('um único gesto enorme não transborda do portal direto para o pan', () => {
    // Atravessar o portal e sair deslizando pela constelação no mesmo gesto
    // seria brusco: a fase termina exatamente em enter = 1.
    const next = push(AT_START, 5_000_000, BOUNDS);
    expect(next.enter).toBe(1);
    expect(next.pan).toBe(0);
  });

  it('nunca sai dos limites', () => {
    expect(push(AT_START, -5_000_000, BOUNDS).enter).toBe(0);
    expect(push({ enter: 1, pan: 3990 }, 5_000_000, BOUNDS).pan).toBe(BOUNDS.max);
    expect(push({ enter: 1, pan: 10 }, -5_000_000, BOUNDS).pan).toBe(BOUNDS.min);
  });

  it('respeita limite mínimo negativo, para acervo anterior à época', () => {
    const bounds = { min: -800, max: 4000 };
    const next = push({ enter: 1, pan: -800 }, -300, bounds);
    expect(next.pan).toBe(-800);
    expect(next.enter).toBeLessThan(1);
  });

  it('delta zero não muda nada', () => {
    expect(push({ enter: 0.4, pan: 0 }, 0, BOUNDS)).toEqual({ enter: 0.4, pan: 0 });
  });

  it('ida e volta do mesmo delta volta ao ponto de partida', () => {
    const start: NavState = { enter: 1, pan: 1200 };
    const roundTrip = push(push(start, 400, BOUNDS), -400, BOUNDS);
    expect(roundTrip.pan).toBeCloseTo(start.pan, 9);
    expect(roundTrip.enter).toBe(start.enter);
  });
});

describe('phaseFor', () => {
  it('vira cosmos só depois da travessia', () => {
    expect(phaseFor(0)).toBe('hero');
    expect(phaseFor(COSMOS_PHASE_ENTER)).toBe('hero');
    expect(phaseFor(COSMOS_PHASE_ENTER + 0.01)).toBe('cosmos');
    expect(phaseFor(1)).toBe('cosmos');
  });
});

describe('funções de transferência do portal', () => {
  it('o hero apaga na faixa 0.02 a 0.44', () => {
    expect(heroFade(0.02)).toBe(0);
    expect(heroFade(0.44)).toBeCloseTo(1, 9);
    expect(heroFade(0)).toBe(0);
    expect(heroFade(1)).toBe(1);
  });

  it('o cosmos surge na faixa 0.62 a 0.96', () => {
    expect(cosmosReveal(0.62)).toBe(0);
    expect(cosmosReveal(0.96)).toBeCloseTo(1, 9);
    expect(cosmosReveal(0.3)).toBe(0);
    expect(cosmosReveal(1)).toBe(1);
  });

  it('o núcleo some na faixa 0.5 a 0.92', () => {
    expect(coreOpacity(0)).toBe(1);
    expect(coreOpacity(0.5)).toBe(1);
    expect(coreOpacity(0.92)).toBeCloseTo(0, 9);
    expect(coreOpacity(1)).toBe(0);
  });

  it('a esfera interna some até 0.7', () => {
    expect(innerGlow(0)).toBe(1);
    expect(innerGlow(0.7)).toBe(0);
    expect(innerGlow(1)).toBe(0);
  });

  it('a câmera vai de 4.3 a 0.25', () => {
    expect(cameraZ(0)).toBeCloseTo(4.3, 9);
    expect(cameraZ(1)).toBeCloseTo(0.25, 9);
  });

  it('a amplitude do ruído vai de 0.34 a 0.84', () => {
    expect(coreAmp(0)).toBeCloseTo(0.34, 9);
    expect(coreAmp(1)).toBeCloseTo(0.84, 9);
  });

  it('o núcleo cresce até 3.9 vezes a escala base', () => {
    expect(coreScale(2, 0)).toBeCloseTo(2, 9);
    expect(coreScale(2, 1)).toBeCloseTo(2 * 3.9, 9);
  });

  it('todas as rampas ficam presas em [0, 1]', () => {
    for (let enter = -0.5; enter <= 1.5; enter += 0.01) {
      for (const ramp of [heroFade, cosmosReveal, coreOpacity]) {
        const value = ramp(enter);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('keyToDelta', () => {
  it('avança com seta direita e PageDown', () => {
    expect(keyToDelta('ArrowRight')).toEqual({ kind: 'delta', value: INPUT.keyStepPx });
    expect(keyToDelta('PageDown')).toEqual({ kind: 'delta', value: INPUT.keyStepPx });
  });

  it('recua com seta esquerda e PageUp', () => {
    expect(keyToDelta('ArrowLeft')).toEqual({ kind: 'delta', value: -INPUT.keyStepPx });
    expect(keyToDelta('PageUp')).toEqual({ kind: 'delta', value: -INPUT.keyStepPx });
  });

  it('Home volta ao início', () => {
    expect(keyToDelta('Home')).toEqual({ kind: 'home' });
  });

  it('End vai para o presente', () => {
    expect(keyToDelta('End')).toEqual({ kind: 'end' });
  });

  it('ignora o resto', () => {
    for (const key of ['a', 'Enter', 'Shift', 'ArrowUp', 'Tab']) {
      expect(keyToDelta(key)).toBeNull();
    }
  });
});

describe('dominantAxisDelta', () => {
  it('escolhe o eixo de maior deslocamento', () => {
    expect(dominantAxisDelta(30, 5)).toBe(30);
    expect(dominantAxisDelta(5, 30)).toBe(30);
  });

  it('preserva o sinal do eixo escolhido', () => {
    expect(dominantAxisDelta(-30, 5)).toBe(-30);
    expect(dominantAxisDelta(5, -30)).toBe(-30);
  });

  it('no empate fica com o horizontal, que é o eixo da constelação', () => {
    expect(dominantAxisDelta(20, -20)).toBe(20);
  });

  it('devolve zero quando não houve movimento', () => {
    expect(dominantAxisDelta(0, 0)).toBe(0);
  });
});

describe('scrubToPan', () => {
  const rail = { left: 100, width: 800 };
  const bounds = { min: 0, max: 5000 };

  it('mapeia a posição do ponteiro direto para o pan', () => {
    expect(scrubToPan(100, rail, bounds)).toBe(0);
    expect(scrubToPan(500, rail, bounds)).toBe(2500);
    expect(scrubToPan(900, rail, bounds)).toBe(5000);
  });

  it('prende nas pontas quando o ponteiro sai da trilha', () => {
    expect(scrubToPan(-400, rail, bounds)).toBe(0);
    expect(scrubToPan(9999, rail, bounds)).toBe(5000);
  });

  it('respeita limite mínimo negativo', () => {
    expect(scrubToPan(100, rail, { min: -600, max: 400 })).toBe(-600);
  });

  it('não divide por zero com trilha sem largura', () => {
    expect(scrubToPan(300, { left: 100, width: 0 }, bounds)).toBe(bounds.min);
  });
});

describe('panToScrubFraction', () => {
  it('é o inverso de scrubToPan', () => {
    const bounds = { min: 0, max: 5000 };
    expect(panToScrubFraction(0, bounds)).toBe(0);
    expect(panToScrubFraction(2500, bounds)).toBe(0.5);
    expect(panToScrubFraction(5000, bounds)).toBe(1);
  });

  it('devolve zero quando não há o que percorrer', () => {
    expect(panToScrubFraction(0, { min: 0, max: 0 })).toBe(0);
  });
});

describe('needsSlide', () => {
  it('não move a câmera por uma estrela já enquadrada', () => {
    expect(needsSlide(640, 1280)).toBe(false);
    expect(needsSlide(100, 1280)).toBe(false);
  });

  it('move quando a estrela caiu fora da tela', () => {
    expect(needsSlide(-40, 1280)).toBe(true);
    expect(needsSlide(1400, 1280)).toBe(true);
  });

  it('move quando a estrela está colada na borda, meio encoberta', () => {
    expect(needsSlide(10, 1280)).toBe(true);
    expect(needsSlide(1275, 1280)).toBe(true);
  });

  it('a margem é simétrica', () => {
    const width = 1280;
    for (let margin = 0; margin < 120; margin += 7) {
      expect(needsSlide(margin, width)).toBe(needsSlide(width - margin, width));
    }
  });
});

import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

import {
  parseSavedProgress,
  percentLabel,
  progressKey,
  scrollProgress,
  shouldOfferResume,
} from '../core/readingProgress';

/** `localStorage` lança em modo privado em alguns navegadores. */
function readSaved(slug: string): number | null {
  try {
    return parseSavedProgress(window.localStorage.getItem(progressKey(slug)));
  } catch {
    return null;
  }
}

function save(slug: string, progress: number): void {
  try {
    window.localStorage.setItem(progressKey(slug), progress.toFixed(3));
  } catch {
    // Sem armazenamento, só não há "continuar" na próxima visita.
  }
}

const SAVE_EVERY_MS = 600;

export interface ReadingProgressTargets {
  /** Recebe `transform: scaleX(p)`. */
  readonly bar: RefObject<HTMLElement>;
  /** Recebe o `43%` como texto. */
  readonly label: RefObject<HTMLElement>;
}

/**
 * O progresso de leitura da rolagem de `scroller`, escrito direto no DOM.
 *
 * Mudar por rolagem é mudar por quadro, e nada que muda por quadro passa pelo
 * React (regra do repositório): a barra e o número são escritos por
 * referência, num `requestAnimationFrame` por evento de rolagem. O React só
 * guarda o que é discreto — a fração salva da visita anterior, para oferecer
 * "continuar de onde parou".
 */
export function useReadingProgress(
  scroller: RefObject<HTMLElement>,
  slug: string,
  targets: ReadingProgressTargets,
): number | null {
  const [resumeAt, setResumeAt] = useState<number | null>(() => {
    const saved = readSaved(slug);
    return shouldOfferResume(saved) ? saved : null;
  });

  useEffect(() => {
    const element = scroller.current;
    if (!element) return;

    let frame = 0;
    let lastSaved = 0;
    let latest = 0;

    const paint = (): void => {
      frame = 0;
      latest = scrollProgress(element.scrollTop, element.scrollHeight, element.clientHeight);
      targets.bar.current?.style.setProperty('transform', `scaleX(${latest.toFixed(4)})`);
      if (targets.label.current) targets.label.current.textContent = percentLabel(latest);
      const now = performance.now();
      if (now - lastSaved > SAVE_EVERY_MS) {
        lastSaved = now;
        save(slug, latest);
      }
    };

    const onScroll = (): void => {
      if (frame === 0) frame = requestAnimationFrame(paint);
      // Rolou por conta própria: a oferta de continuar deixa de fazer sentido.
      if (element.scrollTop > 0) setResumeAt(null);
    };

    paint();
    element.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      element.removeEventListener('scroll', onScroll);
      if (frame !== 0) cancelAnimationFrame(frame);
      // Ao fechar no topo de um artigo já lido, não apaga o que se leu.
      if (latest > 0) save(slug, latest);
    };
  }, [scroller, slug, targets.bar, targets.label]);

  return resumeAt;
}

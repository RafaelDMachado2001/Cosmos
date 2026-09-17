import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

import styles from './ReaderView.module.css';
import type { Category } from '../../core/types';
import { useLocale } from '../../i18n/useLocale';

/** O artigo já formatado. Montado por quem tem o idioma e o acervo em mãos. */
export interface ReaderCard {
  readonly category: Category;
  readonly categoryLabel: string;
  readonly dateLabel: string;
  /** `3 / 14  ·  MAI 2025`. */
  readonly timelineLabel: string;
  readonly title: string;
  readonly summary: string;
  readonly body: readonly string[];
}

export interface ReaderViewProps {
  /**
   * O overlay. Recebido de fora porque quem escreve nele é o laço de quadro,
   * não este componente: `opacity` e `transform` sobem interpolados.
   */
  readonly overlayRef: RefObject<HTMLDivElement>;
  readonly card: ReaderCard;
  readonly onClose: () => void;
}

const TITLE_ID = 'leitura-titulo';

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A vista de leitura.
 *
 * Um overlay, não uma rota: a fase 6 é que assume a History API. O `href` das
 * estrelas já é o definitivo e continua valendo para crawler e para Tab — aqui
 * o clique apenas foi interceptado.
 *
 * A constelação continua montada atrás, com suas estrelas focáveis, então o
 * foco precisa ser preso: sem isso o Tab sairia do artigo para links invisíveis
 * sob o overlay.
 */
export function ReaderView({ overlayRef, card, onClose }: ReaderViewProps) {
  const { t } = useLocale();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Tab') return;
      const focusable = Array.from(overlay.querySelectorAll<HTMLElement>(FOCUSABLE));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      const active = document.activeElement;
      const outside = !(active instanceof Node) || !overlay.contains(active);
      if (event.shiftKey ? active === first || outside : active === last || outside) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [overlayRef]);

  return (
    <div
      ref={overlayRef}
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby={TITLE_ID}
      style={{ ['--star-color' as string]: `var(--color-cat-${card.category})` }}
    >
      <button
        ref={closeRef}
        type="button"
        className={styles.close}
        onClick={onClose}
        aria-label={t.reader.close}
        title={t.reader.close}
      >
        <span aria-hidden="true">&#10005;</span>
      </button>

      {/* A estrela ampliada não acrescenta informação: o artigo já traz título,
          categoria, data e posição escritos. */}
      <aside className={styles.aside} aria-hidden="true">
        <span className={styles.aura} />
        <span className={styles.halo} />
        <span className={styles.core} />
        <span className={styles.ring} />
        <span className={styles.asideMeta}>
          <span className={styles.asideDate}>{card.dateLabel}</span>
          <span className={styles.asidePosition}>{card.timelineLabel}</span>
        </span>
      </aside>

      <article className={styles.article}>
        <div className={styles.measure}>
          <p className={styles.meta}>
            <span className={styles.dot} aria-hidden="true" />
            {card.categoryLabel}
            <span className={styles.metaDate}>/ {card.dateLabel}</span>
          </p>

          <h1 id={TITLE_ID} className={styles.title}>
            {card.title}
          </h1>
          <p className={styles.lede}>{card.summary}</p>
          <div className={styles.filet} aria-hidden="true" />

          {card.body.map((paragraph, index) => (
            <p key={index} className={styles.paragraph}>
              {paragraph}
            </p>
          ))}

          <footer className={styles.footer}>
            <span className={styles.position}>{card.timelineLabel}</span>
            <button type="button" className={styles.back} onClick={onClose}>
              {t.reader.back}
            </button>
          </footer>
        </div>
      </article>
    </div>
  );
}

import { useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';

import styles from './ReaderView.module.css';
import { ArticleBody } from '../ArticleBody/ArticleBody';
import { categoryThemeStyle } from '../CategoryTheme/themeStyle';
import { Nebula } from '../Nebula/Nebula';
import type { Appearance } from '../../core/appearance';
import { parseBlocks } from '../../core/blocks';
import { outline } from '../../core/outline';
import { readingMinutes } from '../../core/readingTime';
import type { Category } from '../../core/types';
import { useActiveHeading } from '../../hooks/useActiveHeading';
import { useReadingProgress } from '../../hooks/useReadingProgress';
import { useLocale } from '../../i18n/useLocale';

/** O artigo já formatado. Montado por quem tem o idioma e o acervo em mãos. */
export interface ReaderCard {
  readonly slug: string;
  readonly category: Category;
  readonly categoryLabel: string;
  readonly dateLabel: string;
  /** `3 / 14  ·  MAI 2025`. */
  readonly timelineLabel: string;
  readonly title: string;
  readonly summary: string;
  /** Markdown cru — ver `PublicationContent.body` em `core/types.ts`. */
  readonly body: string;
  /** Já resolvida: o padrão global quando a publicação não grava nenhuma. */
  readonly appearance: Appearance;
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

/** A folga do sumário: o intertítulo para abaixo do botão de fechar. */
const TOC_OFFSET_PX = 80;

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * A vista de leitura.
 *
 * Um overlay, não uma rota: a fase 6 é que assume a History API. O `href` das
 * estrelas já é o definitivo e continua valendo para crawler e para Tab — aqui
 * o clique apenas foi interceptado.
 *
 * O overlay é o contêiner de rolagem; o painel da esquerda fica preso a ele
 * (`sticky`) com o planeta, o sumário e o progresso. A constelação continua
 * montada atrás, com suas estrelas focáveis, então o foco precisa ser preso:
 * sem isso o Tab sairia do artigo para links invisíveis sob o overlay.
 */
export function ReaderView({ overlayRef, card, onClose }: ReaderViewProps) {
  const { t } = useLocale();
  const closeRef = useRef<HTMLButtonElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const percentRef = useRef<HTMLSpanElement>(null);
  const orbRef = useRef<HTMLDivElement>(null);

  const blocks = useMemo(() => parseBlocks(card.body), [card.body]);
  const entries = useMemo(() => outline(blocks), [blocks]);
  const ids = useMemo(() => entries.map((entry) => entry.id), [entries]);
  const minutes = useMemo(() => readingMinutes(blocks), [blocks]);

  const active = useActiveHeading(ids, overlayRef);
  const resumeAt = useReadingProgress(overlayRef, card.slug, { bar: barRef, label: percentRef });

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

  function scrollToTop(top: number): void {
    overlayRef.current?.scrollTo({ top, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }

  function goToHeading(id: string): void {
    const overlay = overlayRef.current;
    const heading = overlay?.querySelector<HTMLElement>(`[id="${id}"]`);
    if (!overlay || !heading) return;
    const top =
      heading.getBoundingClientRect().top - overlay.getBoundingClientRect().top + overlay.scrollTop;
    scrollToTop(top - TOC_OFFSET_PX);
  }

  function resume(): void {
    const overlay = overlayRef.current;
    if (!overlay || resumeAt === null) return;
    scrollToTop(resumeAt * (overlay.scrollHeight - overlay.clientHeight));
  }

  /**
   * O planeta acompanha o ponteiro: escrito direto no estilo, como tudo que
   * muda a cada movimento. Sem ponteiro fino (toque), fica parado.
   */
  function tiltOrb(event: React.PointerEvent<HTMLElement>): void {
    const orb = orbRef.current;
    if (!orb || event.pointerType !== 'mouse') return;
    const box = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width - 0.5;
    const y = (event.clientY - box.top) / box.height - 0.5;
    orb.style.setProperty('--tilt-x', x.toFixed(3));
    orb.style.setProperty('--tilt-y', y.toFixed(3));
  }

  function resetOrb(): void {
    orbRef.current?.style.setProperty('--tilt-x', '0');
    orbRef.current?.style.setProperty('--tilt-y', '0');
  }

  const meta = `${card.dateLabel} · ${String(minutes)} ${t.reader.minutes}`;

  return (
    <div
      ref={overlayRef}
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby={TITLE_ID}
      style={categoryThemeStyle(card.category)}
    >
      <aside className={styles.aside} onPointerMove={tiltOrb} onPointerLeave={resetOrb}>
        <Nebula
          seed={card.slug}
          variant="tall"
          intensity={card.appearance.nebula}
          motion={card.appearance.motion}
        />

        <button type="button" className={styles.backLink} onClick={onClose}>
          <span aria-hidden="true">←</span> {t.reader.constellation}
        </button>

        {/* O planeta não acrescenta informação: o artigo já traz título,
            categoria, data e posição escritos. */}
        <div ref={orbRef} className={styles.orb} aria-hidden="true">
          <span className={styles.aura} />
          <span className={styles.halo} />
          <span className={styles.ring} />
          <span className={styles.core} />
          <span className={styles.glint} />
        </div>

        <div className={styles.asideMeta}>
          <p className={styles.asideCategory}>
            <span className={styles.dot} aria-hidden="true" />
            {card.categoryLabel}
          </p>
          <p className={styles.asideDate}>{meta}</p>
          <p className={styles.asidePosition}>{card.timelineLabel}</p>
        </div>

        {entries.length > 0 && (
          <nav className={styles.toc} aria-label={t.reader.inThisArticle}>
            <p className={styles.tocTitle}>{t.reader.inThisArticle}</p>
            <ol className={styles.tocList}>
              {entries.map((entry) => (
                <li key={entry.id} data-level={entry.level}>
                  <a
                    href={`#${entry.id}`}
                    className={styles.tocLink}
                    aria-current={entry.id === active ? 'location' : undefined}
                    onClick={(event) => {
                      event.preventDefault();
                      goToHeading(entry.id);
                    }}
                  >
                    {entry.label}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        )}

        <div className={styles.progress}>
          <div className={styles.progressHead}>
            <span>{t.reader.progress}</span>
            <span ref={percentRef} className={styles.progressValue}>
              0%
            </span>
          </div>
          <span className={styles.progressTrack} aria-hidden="true">
            <span ref={barRef} className={styles.progressBar} />
          </span>
          {resumeAt !== null && (
            <button type="button" className={styles.resume} onClick={resume}>
              {t.reader.resume} · {Math.round(resumeAt * 100)}%
            </button>
          )}
        </div>
      </aside>

      <article className={styles.article}>
        {/* Estrelas presas à tela por toda a coluna, e a nebulosa só atrás do
            cabeçalho — as duas vão de borda a borda, por baixo do X. */}
        <div className={styles.starfield} aria-hidden="true">
          <Nebula
            seed={`${card.slug}/campo`}
            variant="wide"
            intensity={0}
            motion={card.appearance.motion}
            starsOnly
          />
        </div>
        <Nebula
          className={styles.headerNebula}
          seed={card.slug}
          variant="wide"
          intensity={card.appearance.nebula * 0.85}
          motion={card.appearance.motion}
        />

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

        <div className={styles.inner}>
          <header className={styles.header}>
            <p className={styles.meta}>
              <span className={styles.dot} aria-hidden="true" />
              {card.categoryLabel}
              <span className={styles.metaDate}>/ {meta}</span>
            </p>

            <h1 id={TITLE_ID} className={styles.title}>
              {card.title}
            </h1>
            <p className={styles.lede}>{card.summary}</p>
            <div className={styles.filet} aria-hidden="true" />
          </header>

          <div className={styles.body}>
            <ArticleBody markdown={card.body} />
          </div>

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

import styles from './HoverPanel.module.css';
import type { HoverSide } from '../../core/reader';
import type { Category } from '../../core/types';
import { useLocale } from '../../i18n/useLocale';

export interface HoverCard {
  readonly slug: string;
  readonly side: HoverSide;
  readonly categoryLabel: string;
  readonly dateLabel: string;
  readonly title: string;
  readonly summary: string;
  readonly via: HoverVia;
}

export type HoverVia = 'pointer' | 'touch';

export interface HoverPanelProps {
  readonly card: HoverCard;
  readonly category: Category;
  readonly x: number;
  readonly yPx: number;
  readonly dock?: { readonly edge: 'top' | 'bottom'; readonly offsetPx: number } | null;
}

export function HoverPanel({ card, category, x, yPx, dock = null }: HoverPanelProps) {
  const { t } = useLocale();

  return (
    <div
      className={styles.panel}
      data-side={dock === null ? card.side : undefined}
      data-docked={dock !== null}
      style={{
        ...(dock === null
          ? { left: `${x}px`, top: `${yPx}px` }
          : { [dock.edge]: `${dock.offsetPx}px` }),
        ['--star-color' as string]: `var(--color-cat-${category})`,
      }}
      aria-hidden="true"
    >
      <p className={styles.meta}>
        <span className={styles.dot} />
        {card.categoryLabel}
        <span className={styles.date}>{card.dateLabel}</span>
      </p>

      <h2 className={styles.title}>{card.title}</h2>
      <p className={styles.summary}>{card.summary}</p>
      <p className={styles.hint}>{card.via === 'touch' ? t.star.tapHint : t.star.openHint}</p>
    </div>
  );
}

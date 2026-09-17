import styles from './HoverPanel.module.css';
import type { HoverSide } from '../../core/reader';
import type { Category } from '../../core/types';
import { useLocale } from '../../i18n/useLocale';

/** O que o cartão mostra. Montado por quem tem o idioma e o acervo em mãos. */
export interface HoverCard {
  readonly slug: string;
  readonly side: HoverSide;
  readonly categoryLabel: string;
  readonly dateLabel: string;
  readonly title: string;
  readonly summary: string;
}

export interface HoverPanelProps {
  readonly card: HoverCard;
  readonly category: Category;
  /** Posição da estrela dentro da camada, em px — o cartão viaja com o pan. */
  readonly x: number;
  readonly yPx: number;
}

/**
 * Cartão de hover, ancorado à estrela.
 *
 * Vive dentro da camada da constelação, e não em cima dela: assim acompanha o
 * pan pelo mesmo `translate3d` de todo o resto, sem custar um segundo laço.
 *
 * `aria-hidden` porque não acrescenta nada — a âncora da estrela já carrega
 * título, categoria e data no `aria-label`, e repetir aqui faria o leitor de
 * tela anunciar tudo duas vezes.
 */
export function HoverPanel({ card, category, x, yPx }: HoverPanelProps) {
  const { t } = useLocale();

  return (
    <div
      className={styles.panel}
      data-side={card.side}
      style={{
        left: `${x}px`,
        top: `${yPx}px`,
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
      <p className={styles.hint}>{t.star.openHint}</p>
    </div>
  );
}

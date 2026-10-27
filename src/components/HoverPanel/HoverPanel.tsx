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
  /** Pelo toque o painel pede um segundo toque; pelo mouse, um clique abre. */
  readonly via: HoverVia;
}

export type HoverVia = 'pointer' | 'touch';

export interface HoverPanelProps {
  readonly card: HoverCard;
  readonly category: Category;
  /** Posição da estrela dentro da camada, em px — o cartão viaja com o pan. */
  readonly x: number;
  readonly yPx: number;
  /**
   * Em tela estreita o cartão não cabe ao lado da estrela (`hoverDocked`): sai
   * da camada e encaixa centrado, longe da metade da tela onde ela está.
   */
  readonly dock?: { readonly edge: 'top' | 'bottom'; readonly offsetPx: number } | null;
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

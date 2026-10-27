import styles from './ArticleIndex.module.css';
import { useLocale } from '../../i18n/useLocale';

/** Uma publicação na lista estática: o bastante para decidir se vale abrir. */
export interface ArticleLink {
  readonly href: string;
  readonly title: string;
  readonly summary: string;
  readonly categoryLabel: string;
  /** `SET 2026`, como na constelação. */
  readonly dateLabel: string;
  /** ISO 8601: o `datetime` que a máquina lê, sob o rótulo que a pessoa lê. */
  readonly publishedAt: string;
}

/**
 * O acervo inteiro no HTML pré-renderizado, na home e no fim de cada artigo.
 *
 * Só os títulos diziam pouco a quem chega sem JavaScript, e nada a um buscador
 * sobre do que trata cada link. Com resumo, categoria e data em `<time>`, a
 * lista vale por si.
 */
export function ArticleIndex({
  items,
  className,
}: {
  readonly items: readonly ArticleLink[];
  readonly className?: string | undefined;
}) {
  const { t } = useLocale();

  return (
    <nav className={[styles.index, className ?? ''].join(' ')} aria-label={t.star.indexLabel}>
      <h2 className={styles.indexTitle}>{t.star.indexLabel}</h2>
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.href} className={styles.item}>
            <a className={styles.link} href={item.href}>
              {item.title}
            </a>
            <p className={styles.meta}>
              {item.categoryLabel} · <time dateTime={item.publishedAt}>{item.dateLabel}</time>
            </p>
            <p className={styles.summary}>{item.summary}</p>
          </li>
        ))}
      </ul>
    </nav>
  );
}

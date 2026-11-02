import styles from './ArticleIndex.module.css';
import { useLocale } from '../../i18n/useLocale';

export interface ArticleLink {
  readonly href: string;
  readonly title: string;
  readonly summary: string;
  readonly categoryLabel: string;
  readonly dateLabel: string;
  readonly publishedAt: string;
}

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

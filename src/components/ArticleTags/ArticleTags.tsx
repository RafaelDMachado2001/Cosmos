import styles from './ArticleTags.module.css';
import { useLocale } from '../../i18n/useLocale';

export interface ArticleTagsProps {
  readonly tags: readonly string[];
  readonly className?: string | undefined;
}

export function ArticleTags({ tags, className }: ArticleTagsProps): React.JSX.Element | null {
  const { t } = useLocale();
  if (tags.length === 0) return null;

  return (
    <ul className={className === undefined ? styles.tags : `${styles.tags} ${className}`} aria-label={t.reader.tags}>
      {tags.map((tag) => (
        <li key={tag} className={styles.tag}>
          <span className={styles.hash} aria-hidden="true">
            #
          </span>
          {tag}
        </li>
      ))}
    </ul>
  );
}

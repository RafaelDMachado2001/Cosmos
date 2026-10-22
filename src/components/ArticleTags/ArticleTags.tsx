import styles from './ArticleTags.module.css';
import { useLocale } from '../../i18n/useLocale';

export interface ArticleTagsProps {
  readonly tags: readonly string[];
  /** A margem é de quem monta: a leitura e a página estática têm ritmos próprios. */
  readonly className?: string | undefined;
}

/**
 * As tags do artigo, entre o subtítulo e o filete. Texto, não link: o site
 * não tem página por tag, e um link para a busca levaria a uma constelação
 * filtrada por texto, não pela tag. Sem tags, nada é desenhado.
 */
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

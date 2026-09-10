import styles from './SkipLink.module.css';
import { useLocale } from '../../i18n/useLocale';

export function SkipLink() {
  const { t } = useLocale();
  return (
    <a className={styles.link} href="#conteudo">
      {t.nav.skipToContent}
    </a>
  );
}

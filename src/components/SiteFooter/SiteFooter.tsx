import styles from './SiteFooter.module.css';
import { homePath, privacyPath } from '../../core/routing';
import { useLocale } from '../../i18n/useLocale';

export interface SiteFooterProps {
  readonly current?: 'privacy';
  readonly className?: string | undefined;
}

const YEAR = new Date().getUTCFullYear();

export function SiteFooter({ current, className }: SiteFooterProps) {
  const { locale, t } = useLocale();

  return (
    <footer className={[styles.footer, className].filter(Boolean).join(' ')}>
      <span className={styles.brand}>{t.footer.brand}</span>
      {current === 'privacy' ? (
        <span className={styles.current} aria-current="page">
          {t.footer.privacy}
        </span>
      ) : (
        <a className={styles.link} href={privacyPath(locale)}>
          {t.footer.privacy}
        </a>
      )}
      <a className={styles.link} href={homePath(locale)}>
        {t.footer.constellation}
      </a>
      <span className={styles.year}>© {YEAR}</span>
    </footer>
  );
}

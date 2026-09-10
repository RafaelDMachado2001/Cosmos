import styles from './LocaleToggle.module.css';
import { LOCALES } from '../../core/types';
import { useLocale } from '../../i18n/useLocale';

export function LocaleToggle() {
  const { locale, t, setLocale } = useLocale();

  return (
    <nav className={styles.toggle} aria-label={t.nav.localeLabel}>
      {LOCALES.map((option) => (
        <button
          key={option}
          type="button"
          className={styles.option}
          aria-pressed={option === locale}
          onClick={() => {
            setLocale(option);
          }}
        >
          {option.toUpperCase()}
        </button>
      ))}
    </nav>
  );
}

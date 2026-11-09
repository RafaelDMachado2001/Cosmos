import { forwardRef } from 'react';

import styles from './Header.module.css';
import { useLocale } from '../../i18n/useLocale';
import { AccountSlot } from '../AccountSlot/AccountSlot';
import { BrandMark } from '../BrandMark/BrandMark';
import { LocaleToggle } from '../LocaleToggle/LocaleToggle';
import { SearchField } from '../SearchField/SearchField';

export interface HeaderProps {
  readonly phase: 'hero' | 'cosmos';
  readonly concealed: boolean;
  readonly query: string;
  readonly categoriesOpen: boolean;
  readonly onBrandClick: () => void;
  readonly onQueryChange: (value: string) => void;
  readonly onToggleCategories: () => void;
}

export const Header = forwardRef<HTMLElement, HeaderProps>(function Header(
  { phase, concealed, query, categoriesOpen, onBrandClick, onQueryChange, onToggleCategories },
  ref,
) {
  const { t } = useLocale();
  const inCosmos = phase === 'cosmos';

  return (
    <header
      ref={ref}
      className={styles.header}
      data-phase={phase}
      data-concealed={concealed}
      aria-hidden={concealed}
      {...(concealed ? { inert: '' } : {})}
    >
      <button type="button" className={styles.brand} onClick={onBrandClick}>
        <BrandMark product="cosmos" className={styles.mark} />
        <span className={styles.brandText}>{t.nav.brand}</span>
      </button>

      <nav
        className={styles.nav}
        aria-label={t.nav.primaryLabel}
        data-visible={inCosmos}
        aria-hidden={!inCosmos}
        {...(inCosmos ? {} : { inert: '' })}
      >
        <button
          type="button"
          className={styles.navButton}
          data-role="home"
          onClick={onBrandClick}
        >
          <span aria-hidden="true">← </span>
          {t.nav.home}
        </button>
        <button
          type="button"
          className={styles.navButton}
          data-active={categoriesOpen}
          aria-expanded={categoriesOpen}
          aria-label={t.nav.categories}
          onClick={onToggleCategories}
        >
          <span className={styles.navText}>{t.nav.categories}</span>
          <svg className={styles.navIcon} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path
              d="M2 4h12M4.5 8h7M7 12h2"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </nav>

      <SearchField visible={inCosmos} value={query} onChange={onQueryChange} />

      <div className={styles.spacer} />
      <AccountSlot />
      <LocaleToggle />
    </header>
  );
});

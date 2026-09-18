import { forwardRef } from 'react';

import styles from './Header.module.css';
import { useLocale } from '../../i18n/useLocale';
import { LocaleToggle } from '../LocaleToggle/LocaleToggle';
import { SearchField } from '../SearchField/SearchField';

export interface HeaderProps {
  /** No hero só a marca e o idioma aparecem; o resto entra no cosmos. */
  readonly phase: 'hero' | 'cosmos';
  readonly query: string;
  readonly categoriesOpen: boolean;
  readonly onBrandClick: () => void;
  readonly onQueryChange: (value: string) => void;
  readonly onToggleCategories: () => void;
}

export const Header = forwardRef<HTMLElement, HeaderProps>(function Header(
  { phase, query, categoriesOpen, onBrandClick, onQueryChange, onToggleCategories },
  ref,
) {
  const { t } = useLocale();
  const inCosmos = phase === 'cosmos';

  return (
    <header ref={ref} className={styles.header}>
      <button type="button" className={styles.brand} onClick={onBrandClick}>
        <span className={styles.mark} aria-hidden="true" />
        {t.nav.brand}
      </button>

      {/* A navegação existe desde o hero, mas invisível e sem foco: aparecer
          por opacidade evita o salto de layout na travessia. */}
      <nav
        className={styles.nav}
        aria-label={t.nav.primaryLabel}
        data-visible={inCosmos}
        aria-hidden={!inCosmos}
        {...(inCosmos ? {} : { inert: '' })}
      >
        <span className={styles.navItem}>{t.nav.cosmos}</span>
        <button
          type="button"
          className={styles.navButton}
          data-active={categoriesOpen}
          aria-expanded={categoriesOpen}
          onClick={onToggleCategories}
        >
          {t.nav.categories}
        </button>
        <span className={styles.navItem}>{t.nav.portfolio}</span>
      </nav>

      {/* A busca só age no cosmos: no hero não há constelação para filtrar. */}
      <SearchField visible={inCosmos} value={query} onChange={onQueryChange} />

      <div className={styles.spacer} />
      <LocaleToggle />
    </header>
  );
});

import { forwardRef } from 'react';

import styles from './Header.module.css';
import { useLocale } from '../../i18n/useLocale';
import { LocaleToggle } from '../LocaleToggle/LocaleToggle';
import { SearchField } from '../SearchField/SearchField';

export interface HeaderProps {
  /** No hero só a marca e o idioma aparecem; o resto entra no cosmos. */
  readonly phase: 'hero' | 'cosmos';
  /**
   * Com a vista de leitura montada o cabeçalho sai: ela tem o próprio
   * "← Constelação", e o da home aparecia como fantasma atrás dele enquanto
   * o overlay ainda não estava opaco.
   */
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
        <span className={styles.mark} aria-hidden="true" />
        <span className={styles.brandText}>{t.nav.brand}</span>
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
          {/* No celular o texto sai e fica o ícone de filtro. */}
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

      {/* A busca só age no cosmos: no hero não há constelação para filtrar. */}
      <SearchField visible={inCosmos} value={query} onChange={onQueryChange} />

      <div className={styles.spacer} />
      <LocaleToggle />
    </header>
  );
});

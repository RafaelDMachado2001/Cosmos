import { forwardRef } from 'react';

import styles from './Header.module.css';
import { useLocale } from '../../i18n/useLocale';
import { LocaleToggle } from '../LocaleToggle/LocaleToggle';

export interface HeaderProps {
  /** No hero só a marca e o idioma aparecem; o resto entra no cosmos. */
  readonly phase: 'hero' | 'cosmos';
  readonly onBrandClick: () => void;
}

export const Header = forwardRef<HTMLElement, HeaderProps>(function Header(
  { phase, onBrandClick },
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
        data-visible={inCosmos}
        aria-hidden={!inCosmos}
        {...(inCosmos ? {} : { inert: '' })}
      >
        <span className={styles.navItem}>{t.nav.cosmos}</span>
        <span className={styles.navItem}>{t.nav.categories}</span>
        <span className={styles.navItem}>{t.nav.portfolio}</span>
      </nav>

      <div className={styles.spacer} />
      <LocaleToggle />
    </header>
  );
});

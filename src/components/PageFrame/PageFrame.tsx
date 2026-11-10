import { useRef } from 'react';
import type { ReactNode } from 'react';

import styles from './PageFrame.module.css';
import { homePath } from '../../core/routing';
import { useSmoothScroll } from '../../hooks/useSmoothScroll';
import { useLocale } from '../../i18n/useLocale';
import { AccountSlot } from '../AccountSlot/AccountSlot';
import { BrandMark } from '../BrandMark/BrandMark';
import { LocaleToggle } from '../LocaleToggle/LocaleToggle';
import { SiteFooter } from '../SiteFooter/SiteFooter';

export interface PageFrameProps {
  readonly width: 'account' | 'measure';
  readonly current?: 'privacy';
  readonly otherLocaleHref?: string;
  readonly children: ReactNode;
}

export function PageFrame({ width, current, otherLocaleHref, children }: PageFrameProps) {
  const { locale, t } = useLocale();
  const home = homePath(locale);
  const pageRef = useRef<HTMLDivElement>(null);
  useSmoothScroll(pageRef);

  return (
    <div ref={pageRef} className={styles.page}>
      <header className={styles.top}>
        <a className={styles.brand} href={home}>
          <BrandMark product="cosmos" className={styles.mark} />
          <span className={styles.brandText}>{t.nav.brand}</span>
        </a>
        <a className={styles.back} href={home}>
          <span aria-hidden="true">←</span>
          {t.footer.constellation}
        </a>
        <div className={styles.spacer} />
        {otherLocaleHref === undefined ? (
          <>
            <AccountSlot />
            <LocaleToggle />
          </>
        ) : (
          <a
            className={styles.other}
            href={otherLocaleHref}
            hrefLang={t.nav.otherLocaleTag}
            lang={t.nav.otherLocaleTag}
          >
            {t.nav.otherLocale}
          </a>
        )}
      </header>
      <div className={styles.column} data-width={width}>
        <main id="conteudo" className={styles.main} tabIndex={-1}>
          {children}
        </main>
        <SiteFooter {...(current === undefined ? {} : { current })} className={styles.footer} />
      </div>
    </div>
  );
}

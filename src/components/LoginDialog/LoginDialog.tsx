import { useId, useRef } from 'react';

import styles from './LoginDialog.module.css';
import { privacyPath } from '../../core/routing';
import { useLocale } from '../../i18n/useLocale';
import { Dialog } from '../Dialog/Dialog';

export interface LoginDialogProps {
  readonly hrefs: { readonly google: string; readonly github: string };
  readonly onClose: () => void;
}

export function LoginDialog({ hrefs, onClose }: LoginDialogProps) {
  const { locale, t } = useLocale();
  const titleId = useId();
  const firstRef = useRef<HTMLAnchorElement>(null);

  return (
    <Dialog labelledBy={titleId} width="login" initialFocusRef={firstRef} onClose={onClose}>
      <div className={styles.top}>
        <div className={styles.heading}>
          <span className={styles.kicker}>{t.login.kicker}</span>
          <h2 id={titleId} className={styles.title}>
            {t.login.title}
          </h2>
        </div>
        <button type="button" className={styles.close} aria-label={t.login.close} onClick={onClose}>
          <span aria-hidden="true">×</span>
        </button>
      </div>
      <p className={styles.body}>{t.login.body}</p>
      <div className={styles.providers}>
        <a ref={firstRef} className={styles.provider} href={hrefs.google}>
          {t.login.google}
          <span className={styles.arrow} aria-hidden="true">
            →
          </span>
        </a>
        <a className={styles.provider} href={hrefs.github}>
          {t.login.github}
          <span className={styles.arrow} aria-hidden="true">
            →
          </span>
        </a>
      </div>
      <p className={styles.note}>
        {t.login.note} <a href={privacyPath(locale)}>{t.login.privacy}</a>
      </p>
    </Dialog>
  );
}

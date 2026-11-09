import styles from './LoginNotice.module.css';
import type { LoginOutcome } from '../../core/session';
import { useLocale } from '../../i18n/useLocale';

export interface LoginNoticeProps {
  readonly outcome: LoginOutcome;
  readonly onDismiss: () => void;
  readonly onRetry: () => void;
}

export function LoginNotice({ outcome, onDismiss, onRetry }: LoginNoticeProps) {
  const { t } = useLocale();
  const [title, body] =
    outcome === 'unverified'
      ? [t.login.unverifiedTitle, t.login.unverifiedBody]
      : [t.login.failedTitle, t.login.failedBody];

  return (
    <div className={styles.notice} role="alert">
      <div className={styles.top}>
        <span className={styles.dot} aria-hidden="true" />
        <span className={styles.title}>{title}</span>
        <button
          type="button"
          className={styles.dismiss}
          aria-label={t.login.dismiss}
          onClick={onDismiss}
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
      <p className={styles.body}>{body}</p>
      <div>
        <button type="button" className={styles.retry} onClick={onRetry}>
          {t.login.retry}
          <span aria-hidden="true"> →</span>
        </button>
      </div>
    </div>
  );
}

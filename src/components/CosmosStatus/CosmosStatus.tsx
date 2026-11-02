import styles from './CosmosStatus.module.css';
import { useLocale } from '../../i18n/useLocale';

export type CosmosStatusKind = 'loading' | 'empty' | 'error' | 'notfound';

export interface CosmosStatusProps {
  readonly kind: CosmosStatusKind;
  readonly onAction: () => void;
}

export function CosmosStatus({ kind, onAction }: CosmosStatusProps) {
  const { t } = useLocale();
  const copy =
    kind === 'loading'
      ? t.loading
      : kind === 'empty'
        ? t.empty
        : kind === 'notfound'
          ? t.notFound
          : t.error;
  const action = kind === 'error' ? t.error.retry : kind === 'notfound' ? t.notFound.back : null;

  return (
    <div className={styles.status} role="status" aria-live="polite">
      {kind === 'loading' && <span className={styles.axis} aria-hidden="true" />}
      {kind === 'loading' && <span className={styles.pulse} aria-hidden="true" />}
      <p className={styles.title}>{copy.title}</p>
      <p className={styles.subtitle}>{copy.subtitle}</p>

      {action !== null && (
        <button type="button" className={styles.retry} onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  );
}

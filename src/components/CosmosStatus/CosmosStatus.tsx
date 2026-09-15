import styles from './CosmosStatus.module.css';
import { useLocale } from '../../i18n/useLocale';

/**
 * `null` quando há estrelas a mostrar. As três outras causas de uma
 * constelação vazia pedem telas diferentes — ver `src/core/collection.ts`.
 */
export type CosmosStatusKind = 'loading' | 'empty' | 'error';

export interface CosmosStatusProps {
  readonly kind: CosmosStatusKind;
  readonly onRetry: () => void;
}

/**
 * O que ocupa o centro da tela quando a constelação não tem o que mostrar.
 *
 * Mesma composição nos três casos, porque são o mesmo momento para quem lê —
 * muda o texto e, no erro, a ação de repetir. Na espera o eixo temporal é
 * desenhado antes das estrelas, conforme a recomendação do handoff: mostra a
 * forma do que vem em vez de um vazio.
 */
export function CosmosStatus({ kind, onRetry }: CosmosStatusProps) {
  const { t } = useLocale();
  const copy = kind === 'loading' ? t.loading : kind === 'empty' ? t.empty : t.error;

  return (
    <div className={styles.status} role="status" aria-live="polite">
      {kind === 'loading' && <span className={styles.axis} aria-hidden="true" />}
      {kind === 'loading' && <span className={styles.pulse} aria-hidden="true" />}
      <p className={styles.title}>{copy.title}</p>
      <p className={styles.subtitle}>{copy.subtitle}</p>

      {kind === 'error' && (
        <button type="button" className={styles.retry} onClick={onRetry}>
          {t.error.retry}
        </button>
      )}
    </div>
  );
}

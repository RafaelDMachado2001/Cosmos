import styles from './CosmosStatus.module.css';
import { useLocale } from '../../i18n/useLocale';

/**
 * `null` quando há estrelas a mostrar. As outras causas de uma constelação
 * vazia pedem telas diferentes — ver `src/core/collection.ts`. `notfound` é a
 * quarta e não vem do acervo, e sim da URL: um endereço de artigo que não
 * corresponde a publicação nenhuma.
 */
export type CosmosStatusKind = 'loading' | 'empty' | 'error' | 'notfound';

export interface CosmosStatusProps {
  readonly kind: CosmosStatusKind;
  /** Repetir, no erro; voltar à constelação, no 404. Os outros dois não agem. */
  readonly onAction: () => void;
}

/**
 * O que ocupa o centro da tela quando a constelação não tem o que mostrar.
 *
 * Mesma composição nos quatro casos, porque são o mesmo momento para quem lê —
 * muda o texto e, no erro e no 404, a ação. Na espera o eixo temporal é
 * desenhado antes das estrelas, conforme a recomendação do handoff: mostra a
 * forma do que vem em vez de um vazio.
 */
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

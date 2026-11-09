import styles from './ArticleEnd.module.css';
import type { ReactionView } from './useCommunity';
import { countLabel, fill } from '../../core/format';
import { useLocale } from '../../i18n/useLocale';

const SPARK = 'M8 .5 L9.7 6.3 L15.5 8 L9.7 9.7 L8 15.5 L6.3 9.7 L.5 8 L6.3 6.3 Z';

export interface ReactionProps {
  readonly view: ReactionView;
  readonly onToggle: () => void;
  readonly onSignIn: () => void;
}

export function Reaction({ view, onToggle, onSignIn }: ReactionProps) {
  const { locale, t } = useLocale();

  if (view.status === 'loading') return <div className={styles.reactionSkeleton} aria-hidden="true" />;
  if (view.status === 'hidden') return null;

  const on = view.status === 'ready' && view.state.reacted;
  const side =
    view.status !== 'ready'
      ? t.reaction.invite
      : view.state.count === 0
        ? t.reaction.countNone
        : view.state.count === 1
          ? t.reaction.countOne
          : fill(t.reaction.count, { n: countLabel(view.state.count, locale) });

  return (
    <div className={styles.reaction}>
      <button
        type="button"
        className={styles.reactionButton}
        aria-pressed={on}
        aria-describedby="reacao-contagem"
        title={t.reaction.aria}
        onClick={view.status === 'anonymous' ? onSignIn : onToggle}
      >
        <svg className={styles.spark} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path d={SPARK} strokeWidth="1.1" strokeLinejoin="round" />
        </svg>
        {on ? t.reaction.on : t.reaction.off}
      </button>
      <span id="reacao-contagem" className={styles.reactionSide}>
        {side}
      </span>
    </div>
  );
}

import styles from './ArticleEnd.module.css';
import { fullDateLabel, relativeTime, shortDateLabel } from '../../core/community';
import type { CommunityComment } from '../../core/community';
import { fill } from '../../core/format';
import { useLocale } from '../../i18n/useLocale';
import { Avatar } from '../Avatar/Avatar';

export interface CommentItemProps {
  readonly comment: CommunityComment;
  readonly own: boolean;
  readonly fresh: boolean;
  readonly now: number;
  readonly onDelete: (comment: CommunityComment, label: string) => void;
}

export function CommentItem({ comment, own, fresh, now, onDelete }: CommentItemProps) {
  const { locale, t } = useLocale();
  const author = comment.author;
  const name = author === null ? '—' : author.name.trim() === '' ? `@${author.handle}` : author.name;
  const showHandle = author !== null && author.name.trim() !== '';
  const rel = relativeTime(comment.createdAt, now);
  const when =
    rel.kind === 'now'
      ? t.comments.now
      : rel.kind === 'yesterday'
        ? t.comments.yesterday
        : rel.kind === 'minutes'
          ? fill(t.comments.minutesAgo, { n: rel.n })
          : rel.kind === 'hours'
            ? fill(t.comments.hoursAgo, { n: rel.n })
            : rel.kind === 'days'
              ? fill(t.comments.daysAgo, { n: rel.n })
              : shortDateLabel(comment.createdAt, locale);
  const full = fullDateLabel(comment.createdAt, locale);

  return (
    <li className={styles.comment} data-fresh={fresh}>
      <Avatar
        url={author?.avatarUrl ?? null}
        name={author?.name ?? ''}
        handle={author?.handle ?? '?'}
        size="sm"
      />
      <div className={styles.commentMain}>
        <div className={styles.commentTop}>
          <span className={styles.commentName}>{name}</span>
          {showHandle && <span className={styles.commentHandle}>@{author.handle}</span>}
          <time className={styles.commentTime} dateTime={comment.createdAt} title={full}>
            {when}
            <span className="visually-hidden">, {full}</span>
          </time>
          {own && (
            <button
              type="button"
              className={styles.commentDelete}
              aria-label={`${t.comments.deleteAria} ${when}`}
              onClick={() => {
                onDelete(comment, when);
              }}
            >
              {t.comments.delete}
            </button>
          )}
        </div>
        <p className={styles.commentBody}>{comment.body}</p>
      </div>
    </li>
  );
}

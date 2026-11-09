import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';

import styles from './ArticleEnd.module.css';
import { COMMENT_MAX_LENGTH, commentLength, normalizeComment } from '../../core/comments';
import { COUNTER_FROM, draftKey } from '../../core/community';
import type { CommunityComment } from '../../core/community';
import { countLabel, fill } from '../../core/format';
import type { Locale } from '../../core/types';
import type { CommunitySource } from '../../data/CommunitySource';
import { RateLimitedError, UnauthorizedError, ValidationError } from '../../data/http';
import { useLocale } from '../../i18n/useLocale';
import { useAnnounce } from '../Announcer/announce';

type FormError = 'size' | 'rate' | 'expired' | 'failed';

function readDraft(key: string): string {
  try {
    return window.sessionStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

function writeDraft(key: string, value: string): void {
  try {
    if (value === '') window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, value);
  } catch {
  }
}

export interface CommentFormProps {
  readonly source: CommunitySource;
  readonly slug: string;
  readonly locale: Locale;
  readonly focusOnMount: boolean;
  readonly onPosted: (comment: CommunityComment) => void;
  readonly onSignIn: () => void;
}

export function CommentForm({ source, slug, locale, focusOnMount, onPosted, onSignIn }: CommentFormProps) {
  const { t } = useLocale();
  const announce = useAnnounce();
  const key = draftKey(slug, locale);
  const [draft, setDraft] = useState(() => readDraft(key));
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (focusOnMount) fieldRef.current?.focus({ preventScroll: true });
  }, [focusOnMount]);

  const length = commentLength(draft);
  const over = length > COMMENT_MAX_LENGTH;
  const shownError: FormError | null = over ? 'size' : error;
  const message =
    shownError === 'size'
      ? fill(t.comments.errorSize, { max: countLabel(COMMENT_MAX_LENGTH, locale) })
      : shownError === 'rate'
        ? t.comments.errorRate
        : shownError === 'expired'
          ? t.comments.errorExpired
          : shownError === 'failed'
            ? t.comments.errorFailed
            : null;

  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const body = normalizeComment(draft);
    if (body === '' || over || sending) return;
    setSending(true);
    setSent(false);
    setError(null);
    source
      .post(slug, locale, body)
      .then((comment) => {
        setDraft('');
        writeDraft(key, '');
        setSent(true);
        announce(t.comments.sent);
        onPosted(comment);
      })
      .catch((failure: unknown) => {
        writeDraft(key, draft);
        setError(
          failure instanceof ValidationError
            ? 'size'
            : failure instanceof RateLimitedError
              ? 'rate'
              : failure instanceof UnauthorizedError
                ? 'expired'
                : 'failed',
        );
      })
      .finally(() => {
        setSending(false);
      });
  };

  const describedBy = ['comentario-dica', message === null ? null : 'comentario-erro']
    .filter(Boolean)
    .join(' ');

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <label htmlFor="comentario-campo" className={styles.formLabel}>
        {t.comments.formLabel}
      </label>
      <textarea
        ref={fieldRef}
        id="comentario-campo"
        className={styles.field}
        data-invalid={message !== null}
        rows={5}
        value={draft}
        placeholder={t.comments.placeholder}
        disabled={sending}
        aria-invalid={message !== null}
        aria-describedby={describedBy}
        onChange={(event) => {
          setDraft(event.target.value);
          writeDraft(key, event.target.value);
          setSent(false);
          if (error === 'size' || error === 'failed') setError(null);
        }}
      />
      <div className={styles.formMeta}>
        <span id="comentario-dica" className={styles.formHint}>
          {t.comments.hint}
        </span>
        <span
          className={styles.counter}
          data-over={over}
          data-visible={length >= COUNTER_FROM}
          aria-hidden="true"
        >
          {countLabel(length, locale)} / {countLabel(COMMENT_MAX_LENGTH, locale)}
        </span>
      </div>
      {message !== null && (
        <p id="comentario-erro" className={styles.formError}>
          {message}
          {shownError === 'expired' && (
            <>
              {' '}
              <button type="button" className={styles.inlineLink} onClick={onSignIn}>
                {t.comments.signInAgain}
              </button>
            </>
          )}
        </p>
      )}
      <div className={styles.formActions}>
        <button
          type="submit"
          className={styles.publish}
          disabled={sending || normalizeComment(draft) === '' || over}
        >
          {sending ? t.comments.sending : t.comments.publish}
        </button>
        {sent && <span className={styles.sent}>✓ {t.comments.sent}</span>}
      </div>
    </form>
  );
}

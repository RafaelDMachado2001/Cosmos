import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';

import styles from './ArticleEnd.module.css';
import { CommentForm } from './CommentForm';
import { CommentItem } from './CommentItem';
import { Reaction } from './Reaction';
import { Share } from './Share';
import { useCommunity } from './useCommunity';
import { COMMENTS_HASH, isOwnComment } from '../../core/community';
import type { CommunityComment } from '../../core/community';
import { countLabel } from '../../core/format';
import type { CommunitySource } from '../../data/CommunitySource';
import { useLocale } from '../../i18n/useLocale';
import { useSession } from '../../session/useSession';
import { useAnnounce } from '../Announcer/announce';
import { Dialog } from '../Dialog/Dialog';

const FRESH_MS = 2400;
const PRELOAD_MARGIN = '600px 0px';

export interface ArticleEndProps {
  readonly source: CommunitySource | null;
  readonly slug: string;
  readonly title: string;
  readonly url: string;
  readonly scrollRootRef: RefObject<HTMLElement>;
}

function arrivedForComments(): boolean {
  return window.location.hash === `#${COMMENTS_HASH}`;
}

function CommunityArea({
  source,
  slug,
  scrollRootRef,
  sectionRef,
  share,
}: {
  source: CommunitySource;
  slug: string;
  scrollRootRef: RefObject<HTMLElement>;
  sectionRef: RefObject<HTMLElement>;
  share: ReactNode;
}) {
  const { locale, t } = useLocale();
  const announce = useAnnounce();
  const session = useSession();
  const community = useCommunity(source, slug, locale, session.state);
  const { start } = community;
  const [arrived] = useState(arrivedForComments);
  const [fresh, setFresh] = useState<number | null>(null);
  const [target, setTarget] = useState<{ comment: CommunityComment; label: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const bodyId = useId();
  const now = Date.now();
  const returnPath = `${window.location.pathname}#${COMMENTS_HASH}`;
  const signIn = (): void => {
    session.openLogin(returnPath);
  };

  useEffect(() => {
    const section = sectionRef.current;
    if (arrived || !section || typeof IntersectionObserver !== 'function') {
      start();
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          start();
        }
      },
      { root: scrollRootRef.current, rootMargin: PRELOAD_MARGIN },
    );
    observer.observe(section);
    return () => {
      observer.disconnect();
    };
  }, [arrived, start, sectionRef, scrollRootRef]);

  useEffect(() => {
    if (!arrived || community.comments.status !== 'ready') return;
    sectionRef.current?.scrollIntoView({ block: 'start' });
  }, [arrived, community.comments.status, sectionRef]);

  useEffect(() => {
    if (fresh === null) return;
    const timer = window.setTimeout(() => {
      setFresh(null);
    }, FRESH_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [fresh]);

  const ownHandle = session.state.kind === 'member' ? session.state.member.handle : null;
  const { comments, reaction } = community;

  const confirmDelete = (): void => {
    if (target === null || deleting) return;
    setDeleting(true);
    source
      .remove(target.comment.id)
      .then(() => {
        community.removed(target.comment.id);
        setTarget(null);
        announce(t.comments.deleted);
        window.setTimeout(() => headingRef.current?.focus(), 0);
      })
      .catch(() => {
        setTarget(null);
        announce(t.comments.deleteFailed);
      })
      .finally(() => {
        setDeleting(false);
      });
  };

  return (
    <>
      <div className={styles.actions}>
        <Reaction
          view={reaction}
          onSignIn={signIn}
          onToggle={() => {
            void community.toggle().then((ok) => {
              if (!ok) announce(t.reaction.failed);
            });
          }}
        />
        {share}
      </div>

      <div className={styles.comments} data-slot="comments">
        <h2 ref={headingRef} className={styles.commentsTitle} tabIndex={-1}>
          {t.comments.title}
          {comments.status === 'ready' && (
            <span className={styles.commentsCount}> {countLabel(comments.total, locale)}</span>
          )}
        </h2>

        {(comments.status === 'idle' || comments.status === 'loading') && (
          <div className={styles.listSkeleton} aria-busy="true">
            <span className="visually-hidden">{t.comments.loading}</span>
            <span className={styles.skeletonLine} data-width="long" />
            <span className={styles.skeletonLine} data-width="short" />
            <span className={styles.skeletonLine} data-width="mid" />
          </div>
        )}

        {comments.status === 'error' && (
          <div className={styles.error}>
            <span>{t.comments.error}</span>
            <button type="button" className={styles.textButton} onClick={community.retry}>
              {t.comments.retry}
            </button>
          </div>
        )}

        {comments.status === 'ready' && comments.items.length === 0 && (
          <p className={styles.empty}>
            {ownHandle === null ? t.comments.emptyAnonymous : t.comments.emptyMember}
          </p>
        )}

        {comments.status === 'ready' && comments.items.length > 0 && (
          <ol className={styles.list}>
            {comments.items.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                own={isOwnComment(comment, ownHandle)}
                fresh={comment.id === fresh}
                now={now}
                onDelete={(item, label) => {
                  setTarget({ comment: item, label });
                }}
              />
            ))}
          </ol>
        )}

        {comments.status === 'ready' && comments.next !== null && (
          <button
            type="button"
            className={styles.loadMore}
            disabled={comments.loadingMore}
            onClick={community.loadMore}
          >
            {t.comments.loadMore} · {countLabel(Math.max(0, comments.total - comments.items.length), locale)}
          </button>
        )}

        {comments.status !== 'error' && session.state.kind !== 'error' && (
          <div className={styles.formArea}>
            {session.state.kind === 'loading' && <div className={styles.formSkeleton} aria-hidden="true" />}
            {session.state.kind === 'anonymous' && (
              <div className={styles.invite}>
                <p className={styles.inviteTitle}>{t.comments.inviteTitle}</p>
                <p className={styles.inviteBody}>{t.comments.inviteBody}</p>
                <button type="button" className={styles.inviteButton} onClick={signIn}>
                  {t.account.signIn}
                </button>
              </div>
            )}
            {session.state.kind === 'member' && (
              <CommentForm
                source={source}
                slug={slug}
                locale={locale}
                focusOnMount={arrived}
                onSignIn={signIn}
                onPosted={(comment) => {
                  community.appended(comment);
                  setFresh(comment.id);
                }}
              />
            )}
          </div>
        )}
      </div>

      {target !== null && (
        <Dialog
          role="alertdialog"
          labelledBy={titleId}
          describedBy={bodyId}
          width="confirm"
          initialFocusRef={cancelRef}
          onClose={() => {
            if (!deleting) setTarget(null);
          }}
        >
          <h2 id={titleId} className={styles.dialogTitle}>
            {t.comments.deleteTitle}
          </h2>
          <p id={bodyId} className={styles.dialogBody}>
            {t.comments.deleteBody}
          </p>
          <div className={styles.dialogActions}>
            <button
              ref={cancelRef}
              type="button"
              className={styles.cancel}
              disabled={deleting}
              onClick={() => {
                setTarget(null);
              }}
            >
              {t.comments.cancel}
            </button>
            <button type="button" className={styles.confirm} disabled={deleting} onClick={confirmDelete}>
              {t.comments.deleteConfirm}
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}

export function ArticleEnd({ source, slug, title, url, scrollRootRef }: ArticleEndProps) {
  const { t } = useLocale();
  const sectionRef = useRef<HTMLElement>(null);
  const share = <Share url={url} title={title} />;

  return (
    <section ref={sectionRef} id={COMMENTS_HASH} className={styles.block} aria-label={t.comments.region}>
      {source === null ? (
        <div className={styles.actions}>{share}</div>
      ) : (
        <CommunityArea
          source={source}
          slug={slug}
          scrollRootRef={scrollRootRef}
          sectionRef={sectionRef}
          share={share}
        />
      )}
    </section>
  );
}

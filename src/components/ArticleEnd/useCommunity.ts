import { useCallback, useEffect, useRef, useState } from 'react';

import { toggleReaction } from '../../core/community';
import type { CommunityComment, ReactionState } from '../../core/community';
import type { SessionState } from '../../core/session';
import type { Locale } from '../../core/types';
import type { CommunitySource } from '../../data/CommunitySource';

export type CommentsState =
  | { readonly status: 'idle' | 'loading' | 'error' }
  | {
      readonly status: 'ready';
      readonly items: readonly CommunityComment[];
      readonly next: number | null;
      readonly total: number;
      readonly loadingMore: boolean;
    };

export type ReactionView =
  | { readonly status: 'loading' | 'hidden' | 'anonymous' }
  | { readonly status: 'ready'; readonly state: ReactionState };

export interface Community {
  readonly comments: CommentsState;
  readonly reaction: ReactionView;
  readonly start: () => void;
  readonly retry: () => void;
  readonly loadMore: () => void;
  readonly toggle: () => Promise<boolean>;
  readonly appended: (comment: CommunityComment) => void;
  readonly removed: (id: number) => void;
}

function merged(
  current: readonly CommunityComment[],
  incoming: readonly CommunityComment[],
): readonly CommunityComment[] {
  const byId = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) byId.set(item.id, item);
  return [...byId.values()].sort((a, b) => a.id - b.id);
}

export function useCommunity(
  source: CommunitySource,
  slug: string,
  locale: Locale,
  session: SessionState,
): Community {
  const [started, setStarted] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [comments, setComments] = useState<CommentsState>({ status: 'idle' });
  const [reaction, setReaction] = useState<ReactionView>({ status: 'loading' });
  const busyRef = useRef(false);

  useEffect(() => {
    if (!started) return;
    let alive = true;
    setComments({ status: 'loading' });
    source
      .comments(slug, locale)
      .then((page) => {
        if (alive) setComments({ status: 'ready', ...page, loadingMore: false });
      })
      .catch(() => {
        if (alive) setComments({ status: 'error' });
      });
    return () => {
      alive = false;
    };
  }, [source, slug, locale, started, attempt]);

  const signedIn = session.kind === 'member';

  useEffect(() => {
    if (!started) return;
    if (session.kind === 'loading') {
      setReaction({ status: 'loading' });
      return;
    }
    if (session.kind === 'error') {
      setReaction({ status: 'hidden' });
      return;
    }
    if (session.kind === 'anonymous') {
      setReaction({ status: 'anonymous' });
      return;
    }
    let alive = true;
    setReaction({ status: 'loading' });
    source
      .reaction(slug, locale, true)
      .then((state) => {
        if (alive) setReaction({ status: 'ready', state });
      })
      .catch(() => {
        if (alive) setReaction({ status: 'hidden' });
      });
    return () => {
      alive = false;
    };
  }, [source, slug, locale, started, attempt, session.kind, signedIn]);

  const start = useCallback(() => {
    setStarted(true);
  }, []);

  const retry = useCallback(() => {
    setAttempt((value) => value + 1);
  }, []);

  const loadMore = useCallback(() => {
    if (comments.status !== 'ready' || comments.next === null || comments.loadingMore) return;
    const after = comments.next;
    setComments({ ...comments, loadingMore: true });
    source
      .comments(slug, locale, after)
      .then((page) => {
        setComments((current) =>
          current.status === 'ready'
            ? {
                status: 'ready',
                items: merged(current.items, page.items),
                next: page.next,
                total: page.total,
                loadingMore: false,
              }
            : current,
        );
      })
      .catch(() => {
        setComments((current) =>
          current.status === 'ready' ? { ...current, loadingMore: false } : current,
        );
      });
  }, [comments, source, slug, locale]);

  const toggle = useCallback(async (): Promise<boolean> => {
    if (reaction.status !== 'ready' || busyRef.current) return true;
    busyRef.current = true;
    const before = reaction.state;
    const optimistic = toggleReaction(before);
    setReaction({ status: 'ready', state: optimistic });
    try {
      const confirmed = await source.react(slug, locale, optimistic.reacted);
      setReaction({ status: 'ready', state: confirmed });
      return true;
    } catch {
      setReaction({ status: 'ready', state: before });
      return false;
    } finally {
      busyRef.current = false;
    }
  }, [reaction, source, slug, locale]);

  const appended = useCallback((comment: CommunityComment) => {
    setComments((current) =>
      current.status === 'ready'
        ? { ...current, items: merged(current.items, [comment]), total: current.total + 1 }
        : current,
    );
  }, []);

  const removed = useCallback((id: number) => {
    setComments((current) =>
      current.status === 'ready'
        ? {
            ...current,
            items: current.items.filter((item) => item.id !== id),
            total: Math.max(0, current.total - 1),
          }
        : current,
    );
  }, []);

  return { comments, reaction, start, retry, loadMore, toggle, appended, removed };
}

import type { Locale } from './types';

export interface CommentAuthor {
  readonly name: string;
  readonly handle: string;
  readonly avatarUrl: string | null;
}

export interface CommunityComment {
  readonly id: number;
  readonly body: string;
  readonly createdAt: string;
  readonly author: CommentAuthor | null;
}

export interface CommentsPage {
  readonly items: readonly CommunityComment[];
  readonly next: number | null;
  readonly total: number;
}

export interface ReactionState {
  readonly count: number;
  readonly reacted: boolean;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function parseAuthor(value: unknown): CommentAuthor | null {
  const raw = record(value);
  if (raw === null || typeof raw.name !== 'string' || typeof raw.handle !== 'string') return null;
  return {
    name: raw.name,
    handle: raw.handle,
    avatarUrl: typeof raw.avatarUrl === 'string' ? raw.avatarUrl : null,
  };
}

export function parseComment(value: unknown): CommunityComment | null {
  const raw = record(value);
  if (
    raw === null ||
    typeof raw.id !== 'number' ||
    typeof raw.body !== 'string' ||
    typeof raw.createdAt !== 'string'
  ) {
    return null;
  }
  return { id: raw.id, body: raw.body, createdAt: raw.createdAt, author: parseAuthor(raw.author) };
}

export function parseCommentsPage(payload: unknown): CommentsPage {
  const raw = record(payload);
  const meta = record(raw?.meta);
  const items = (Array.isArray(raw?.data) ? raw.data : [])
    .map(parseComment)
    .filter((item): item is CommunityComment => item !== null);
  const next = typeof meta?.next === 'number' ? meta.next : null;
  const total = typeof meta?.total === 'number' ? meta.total : items.length;
  return { items, next, total };
}

export function parseReaction(payload: unknown): ReactionState {
  const data = record(record(payload)?.data);
  return {
    count: typeof data?.count === 'number' ? data.count : 0,
    reacted: data?.reacted === true,
  };
}

export function toggleReaction(state: ReactionState): ReactionState {
  return {
    reacted: !state.reacted,
    count: Math.max(0, state.count + (state.reacted ? -1 : 1)),
  };
}

export function isOwnComment(comment: CommunityComment, handle: string | null): boolean {
  return handle !== null && comment.author?.handle === handle;
}

export type RelativeTime =
  | { readonly kind: 'now' }
  | { readonly kind: 'minutes'; readonly n: number }
  | { readonly kind: 'hours'; readonly n: number }
  | { readonly kind: 'yesterday' }
  | { readonly kind: 'days'; readonly n: number }
  | { readonly kind: 'date' };

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function relativeTime(iso: string, now: number): RelativeTime {
  const elapsed = Math.max(0, now - Date.parse(iso));
  if (elapsed < MINUTE) return { kind: 'now' };
  if (elapsed < HOUR) return { kind: 'minutes', n: Math.floor(elapsed / MINUTE) };
  if (elapsed < DAY) return { kind: 'hours', n: Math.floor(elapsed / HOUR) };
  if (elapsed < 2 * DAY) return { kind: 'yesterday' };
  if (elapsed < 30 * DAY) return { kind: 'days', n: Math.floor(elapsed / DAY) };
  return { kind: 'date' };
}

const DATE_LOCALE: Record<Locale, string> = { pt: 'pt-BR', en: 'en-GB' };

export function fullDateLabel(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(DATE_LOCALE[locale], {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(Date.parse(iso)));
}

export function shortDateLabel(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(DATE_LOCALE[locale], { dateStyle: 'medium' }).format(
    new Date(Date.parse(iso)),
  );
}

export interface ShareLink {
  readonly id: 'linkedin' | 'x' | 'email';
  readonly href: string;
}

export function shareLinks(url: string, title: string): readonly ShareLink[] {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  return [
    { id: 'linkedin', href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
    { id: 'x', href: `https://x.com/intent/post?url=${u}&text=${t}` },
    { id: 'email', href: `mailto:?subject=${t}&body=${u}` },
  ];
}

export function draftKey(slug: string, locale: Locale): string {
  return `rdm:cosmos:comment-draft:${locale}:${slug}`;
}

export const COMMENTS_HASH = 'comentarios';

export const COUNTER_FROM = 1800;

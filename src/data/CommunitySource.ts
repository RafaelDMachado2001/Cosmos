import { parseComment, parseCommentsPage, parseReaction } from '../core/community';
import type { CommentsPage, CommunityComment, ReactionState } from '../core/community';
import type { Locale } from '../core/types';
import { DEFAULT_RETRY, fetchWithRetry } from './fetchWithRetry';
import type { RetryPolicy } from './fetchWithRetry';
import { createSessionClient } from './sessionClient';

export interface CommunitySource {
  comments(slug: string, locale: Locale, after?: number): Promise<CommentsPage>;
  post(slug: string, locale: Locale, body: string): Promise<CommunityComment>;
  remove(id: number): Promise<void>;
  reaction(slug: string, locale: Locale, signedIn: boolean): Promise<ReactionState>;
  react(slug: string, locale: Locale, on: boolean): Promise<ReactionState>;
}

export function createCommunitySource(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
  readCookie: () => string = () => document.cookie,
  retry: RetryPolicy = DEFAULT_RETRY,
): CommunitySource {
  const root = baseUrl.replace(/\/+$/, '');
  const client = createSessionClient(root, fetchImpl, readCookie);
  const slugPath = (slug: string): string => encodeURIComponent(slug);

  async function publicJson(path: string): Promise<unknown> {
    const url = `${root}${path}`;
    const response = await fetchWithRetry(
      fetchImpl,
      url,
      { headers: { Accept: 'application/json' } },
      retry,
    );
    if (!response.ok) throw new Error(`GET ${url} respondeu ${String(response.status)}`);
    return response.json();
  }

  return {
    async comments(slug, locale, after) {
      const params = new URLSearchParams({ locale });
      if (after !== undefined) params.set('after', String(after));
      return parseCommentsPage(
        await publicJson(`/api/publications/${slugPath(slug)}/comments?${params.toString()}`),
      );
    },

    async post(slug, locale, body) {
      const response = await client.send('POST', '/api/me/comments', {
        publication: slug,
        locale,
        body,
      });
      const comment = parseComment(((await response.json()) as { data?: unknown }).data);
      if (comment === null) throw new Error('POST /api/me/comments devolveu um comentário fora do formato');
      return comment;
    },

    async remove(id) {
      await client.send('DELETE', `/api/me/comments/${String(id)}`);
    },

    async reaction(slug, locale, signedIn) {
      const query = `?locale=${locale}`;
      if (!signedIn) {
        return parseReaction(await publicJson(`/api/publications/${slugPath(slug)}/reactions${query}`));
      }
      return parseReaction(await (await client.get(`/api/me/reactions/${slugPath(slug)}${query}`)).json());
    },

    async react(slug, locale, on) {
      const response = await client.send(
        on ? 'PUT' : 'DELETE',
        `/api/me/reactions/${slugPath(slug)}?locale=${locale}`,
      );
      return parseReaction(await response.json());
    },
  };
}

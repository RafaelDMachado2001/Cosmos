import type { Appearance } from '../core/appearance';
import type { DraftBlock } from '../core/draftBlocks';
import type { Category, Locale } from '../core/types';
import { createJsonClient, dataOf } from '../data/http';

export type PublicationStatus = 'draft' | 'scheduled' | 'published';

export interface AdminDraft {
  readonly locale: Locale;
  readonly title: string | null;
  readonly subtitle: string | null;
  readonly blocks: readonly DraftBlock[];
  readonly seoTitle: string | null;
  readonly seoDescription: string | null;
  readonly updatedAt: string | null;
}

export interface AdminReference {
  readonly id: number;
  readonly position: number;
  readonly title: string;
  readonly url: string;
}

export interface AdminPublication {
  readonly id: number;
  readonly slug: string;
  readonly category: Category;
  readonly publishedAt: string;
  readonly featured: boolean;
  readonly indexable: boolean;
  readonly appearance: Appearance | null;
  readonly status: PublicationStatus;
  readonly pendingChanges: boolean;
  readonly tags: readonly string[];
  readonly references: readonly AdminReference[];
  readonly drafts: Partial<Record<Locale, AdminDraft>>;
}

export interface AdminMedia {
  readonly id: number;
  readonly url: string;
  readonly width: number;
  readonly height: number;
  readonly mime: string;
  readonly altDefault: string | null;
}

export interface DraftPatch {
  readonly title?: string | null;
  readonly subtitle?: string | null;
  readonly blocks?: readonly DraftBlock[];
  readonly seoTitle?: string | null;
  readonly seoDescription?: string | null;
}

export interface PublicationPatch {
  readonly slug?: string;
  readonly category?: Category;
  readonly publishedAt?: string;
  readonly featured?: boolean;
  readonly indexable?: boolean;
  readonly appearance?: Appearance | null;
  readonly tags?: readonly string[];
  readonly references?: readonly { readonly title: string; readonly url: string }[];
  readonly drafts?: Partial<Record<Locale, DraftPatch>>;
}

const client = createJsonClient({
  baseUrl: '/admin/api',
  credentials: 'same-origin',
  csrfHeaders: () => ({
    'X-CSRF-TOKEN':
      document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '',
  }),
});

async function read<T>(path: string): Promise<T> {
  return dataOf<T>(await client.get(path));
}

async function write<T>(method: string, path: string, body?: unknown): Promise<T> {
  return dataOf<T>(await client.send(method, path, body));
}

export const api = {
  list: (): Promise<readonly AdminPublication[]> => read('/publications'),

  get: (id: number): Promise<AdminPublication> => read(`/publications/${String(id)}`),

  create: (data: {
    readonly slug: string;
    readonly category: Category;
    readonly publishedAt: string;
    readonly featured?: boolean;
  }): Promise<AdminPublication> => write('POST', '/publications', data),

  update: (id: number, patch: PublicationPatch): Promise<AdminPublication> =>
    write('PATCH', `/publications/${String(id)}`, patch),

  destroy: (id: number): Promise<void> => write('DELETE', `/publications/${String(id)}`),

  publish: (id: number): Promise<AdminPublication> =>
    write('POST', `/publications/${String(id)}/publish`),

  unpublish: (id: number): Promise<AdminPublication> =>
    write('POST', `/publications/${String(id)}/unpublish`),

  uploadMedia: (file: File, alt: string): Promise<AdminMedia> => {
    const form = new FormData();
    form.append('file', file);
    if (alt !== '') form.append('alt', alt);
    return write('POST', '/media', form);
  },

  searchTags: (q: string): Promise<readonly string[]> => read(`/tags?q=${encodeURIComponent(q)}`),
};

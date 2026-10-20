/**
 * O cliente HTTP do RDM Studio, contra `/admin/api/*` (`PublicationAdminController`
 * e companhia, no backend). Sempre mesma origem, sempre a mesma sessão do
 * Filament — só precisa do token CSRF que o Blade grava num `<meta>`.
 */

import type { DraftBlock } from '../core/draftBlocks';
import type { Category, Locale } from '../core/types';

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
  readonly status: PublicationStatus;
  /** No ar, com rascunho editado depois da última publicação. */
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
  readonly tags?: readonly string[];
  readonly references?: readonly { readonly title: string; readonly url: string }[];
  readonly drafts?: Partial<Record<Locale, DraftPatch>>;
}

/** O que `assertJsonValidationErrors`/o 422 do Laravel devolve. */
export class ValidationError extends Error {
  constructor(public readonly fields: Readonly<Record<string, readonly string[]>>) {
    super(Object.values(fields).flat()[0] ?? 'Dados inválidos.');
    this.name = 'ValidationError';
  }
}

/** O 413 do Nginx ou do PHP: o corpo nem chega ao Laravel, então não há 422. */
export class PayloadTooLargeError extends Error {
  constructor(path: string) {
    super(`/admin/api${path} recusou o corpo: grande demais`);
    this.name = 'PayloadTooLargeError';
  }
}

function csrfToken(): string {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase();
  const isJsonBody = typeof init.body === 'string';

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(isJsonBody ? { 'Content-Type': 'application/json' } : {}),
    ...(method === 'GET' ? {} : { 'X-CSRF-TOKEN': csrfToken() }),
  };

  const response = await fetch(`/admin/api${path}`, {
    ...init,
    method,
    headers,
    credentials: 'same-origin',
  });

  if (response.status === 422) {
    const payload = (await response.json()) as { errors?: Record<string, readonly string[]> };
    throw new ValidationError(payload.errors ?? {});
  }

  if (response.status === 413) throw new PayloadTooLargeError(path);

  if (!response.ok) {
    throw new Error(`/admin/api${path} respondeu ${String(response.status)}`);
  }

  if (response.status === 204) return undefined as T;

  const payload = (await response.json()) as { data: T };
  return payload.data;
}

export const api = {
  list: (): Promise<readonly AdminPublication[]> => request('/publications'),

  get: (id: number): Promise<AdminPublication> => request(`/publications/${String(id)}`),

  create: (data: {
    readonly slug: string;
    readonly category: Category;
    readonly publishedAt: string;
    readonly featured?: boolean;
  }): Promise<AdminPublication> =>
    request('/publications', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: number, patch: PublicationPatch): Promise<AdminPublication> =>
    request(`/publications/${String(id)}`, { method: 'PATCH', body: JSON.stringify(patch) }),

  destroy: (id: number): Promise<void> => request(`/publications/${String(id)}`, { method: 'DELETE' }),

  publish: (id: number): Promise<AdminPublication> =>
    request(`/publications/${String(id)}/publish`, { method: 'POST' }),

  unpublish: (id: number): Promise<AdminPublication> =>
    request(`/publications/${String(id)}/unpublish`, { method: 'POST' }),

  uploadMedia: (file: File, alt: string): Promise<AdminMedia> => {
    const form = new FormData();
    form.append('file', file);
    if (alt !== '') form.append('alt', alt);
    return request('/media', { method: 'POST', body: form });
  },

  searchTags: (q: string): Promise<readonly string[]> =>
    request(`/tags?q=${encodeURIComponent(q)}`),
};

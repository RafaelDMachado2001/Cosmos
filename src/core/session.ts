import { isLocale } from './types';
import type { Locale } from './types';

export const PROVIDERS = ['google', 'github'] as const;
export type Provider = (typeof PROVIDERS)[number];

export function isProvider(value: unknown): value is Provider {
  return typeof value === 'string' && (PROVIDERS as readonly string[]).includes(value);
}

export interface Member {
  readonly id: number;
  readonly name: string;
  readonly handle: string;
  readonly avatarUrl: string | null;
  readonly email: string | null;
  readonly locale: Locale;
  readonly providers: readonly Provider[];
}

export type SessionState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'anonymous' }
  | { readonly kind: 'member'; readonly member: Member };

export const LOADING: SessionState = { kind: 'loading' };
export const ANONYMOUS: SessionState = { kind: 'anonymous' };

export function sessionOf(member: Member | null): SessionState {
  return member === null ? ANONYMOUS : { kind: 'member', member };
}

export function parseMember(payload: unknown): Member | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const data = (payload as { data?: unknown }).data;
  if (typeof data !== 'object' || data === null) return null;
  const raw = data as Record<string, unknown>;

  if (
    typeof raw.id !== 'number' ||
    typeof raw.name !== 'string' ||
    typeof raw.handle !== 'string' ||
    !isLocale(raw.locale)
  ) {
    return null;
  }

  return {
    id: raw.id,
    name: raw.name,
    handle: raw.handle,
    avatarUrl: typeof raw.avatarUrl === 'string' ? raw.avatarUrl : null,
    email: typeof raw.email === 'string' ? raw.email : null,
    locale: raw.locale,
    providers: Array.isArray(raw.providers) ? raw.providers.filter(isProvider) : [],
  };
}

export function loginHref(apiUrl: string, provider: Provider, returnPath: string): string {
  const params = new URLSearchParams({ return: returnPath });
  return `${apiUrl.replace(/\/+$/, '')}/auth/${provider}/redirect?${params.toString()}`;
}

export type LoginOutcome = 'failed' | 'unverified';

export function loginOutcome(search: string): LoginOutcome | null {
  const value = new URLSearchParams(search).get('login');
  return value === 'failed' || value === 'unverified' ? value : null;
}

export function xsrfToken(cookie: string): string | null {
  for (const part of cookie.split(';')) {
    const [name, ...value] = part.trim().split('=');
    if (name === 'XSRF-TOKEN') {
      try {
        return decodeURIComponent(value.join('='));
      } catch {
        return null;
      }
    }
  }
  return null;
}

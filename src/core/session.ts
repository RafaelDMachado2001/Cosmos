/**
 * A sessão do leitor (etapa 2, módulo Identity do backend).
 *
 * O HTML pré-renderizado é anônimo e igual para todos — senão o CDN não
 * serviria — e a sessão só existe no cliente, depois de perguntar à API. Até
 * a resposta chegar o estado é `loading`, e a interface não pode tratar isso
 * como anônimo: piscaria "Entrar" para quem já entrou.
 *
 * Módulo puro: sem DOM, sem React, sem fetch.
 */

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

/** O formato de `GET /api/me` (MemberResource), validado campo a campo. */
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
    // Um provedor que o site ainda não conhece não derruba o perfil.
    providers: Array.isArray(raw.providers) ? raw.providers.filter(isProvider) : [],
  };
}

/**
 * O link que começa o login: a API guarda o caminho e devolve a pessoa para
 * ele depois do provedor. Só o caminho — a API recusa qualquer outro host.
 */
export function loginHref(apiUrl: string, provider: Provider, returnPath: string): string {
  const params = new URLSearchParams({ return: returnPath });
  return `${apiUrl.replace(/\/+$/, '')}/auth/${provider}/redirect?${params.toString()}`;
}

/** Por que o login voltou sem sessão — o `?login=` que a API acrescenta. */
export type LoginOutcome = 'failed' | 'unverified';

export function loginOutcome(search: string): LoginOutcome | null {
  const value = new URLSearchParams(search).get('login');
  return value === 'failed' || value === 'unverified' ? value : null;
}

/** O valor do cookie `XSRF-TOKEN`, que o Laravel quer de volta em `X-XSRF-TOKEN`. */
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

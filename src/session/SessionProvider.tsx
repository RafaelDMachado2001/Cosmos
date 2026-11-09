import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import {
  LOADING,
  SESSION_ERROR,
  loginHref,
  loginOutcome,
  sessionOf,
  withoutLoginOutcome,
} from '../core/session';
import type { LoginOutcome, SessionState } from '../core/session';
import type { MemberSource } from '../data/MemberSource';
import { useAnnounce } from '../components/Announcer/announce';
import { LoginDialog } from '../components/LoginDialog/LoginDialog';
import { LoginNotice } from '../components/LoginNotice/LoginNotice';
import { useLocale } from '../i18n/useLocale';
import { SessionContext } from './SessionContext';
import type { SessionValue } from './SessionContext';

export interface SessionProviderProps {
  readonly source: MemberSource | null;
  readonly apiUrl: string | null;
  readonly children: ReactNode;
}

function currentPath(): string {
  return window.location.pathname;
}

export function SessionProvider({ source, apiUrl, children }: SessionProviderProps) {
  const { t } = useLocale();
  const announce = useAnnounce();
  const [state, setState] = useState<SessionState>(source === null ? SESSION_ERROR : LOADING);
  const [attempt, setAttempt] = useState(0);
  const [loginReturn, setLoginReturn] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<LoginOutcome | null>(() =>
    loginOutcome(window.location.search),
  );

  useEffect(() => {
    if (source === null) return;
    let alive = true;
    source
      .me()
      .then((member) => {
        if (alive) setState(sessionOf(member));
      })
      .catch(() => {
        if (alive) setState(SESSION_ERROR);
      });
    return () => {
      alive = false;
    };
  }, [source, attempt]);

  const loginHrefs = useCallback(
    (returnPath: string) =>
      apiUrl === null
        ? null
        : {
            google: loginHref(apiUrl, 'google', returnPath),
            github: loginHref(apiUrl, 'github', returnPath),
          },
    [apiUrl],
  );

  const openLogin = useCallback((returnPath?: string) => {
    setLoginReturn(returnPath ?? currentPath());
  }, []);

  const retry = useCallback(() => {
    setState(LOADING);
    setAttempt((value) => value + 1);
  }, []);

  const signOut = useCallback(async () => {
    if (source === null) return;
    await source.logout();
    setState(sessionOf(null));
    announce(t.account.signedOut);
  }, [source, announce, t]);

  const update = useCallback<SessionValue['update']>(
    async (patch) => {
      if (source === null) throw new Error('sem API, não há conta para salvar');
      const member = await source.update(patch);
      setState(sessionOf(member));
      return member;
    },
    [source],
  );

  const remove = useCallback(async () => {
    if (source === null) return;
    await source.remove();
    setState(sessionOf(null));
  }, [source]);

  const dismissOutcome = useCallback(() => {
    setOutcome(null);
    const { pathname, search, hash } = window.location;
    window.history.replaceState(window.history.state, '', `${pathname}${withoutLoginOutcome(search)}${hash}`);
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      state,
      exportUrl: source?.exportUrl ?? null,
      openLogin,
      loginHrefs,
      retry,
      signOut,
      update,
      remove,
    }),
    [state, source, openLogin, loginHrefs, retry, signOut, update, remove],
  );

  const hrefs = loginReturn === null ? null : loginHrefs(loginReturn);

  return (
    <SessionContext.Provider value={value}>
      {children}
      {outcome !== null && (
        <LoginNotice
          outcome={outcome}
          onDismiss={dismissOutcome}
          onRetry={() => {
            dismissOutcome();
            openLogin();
          }}
        />
      )}
      {hrefs !== null && (
        <LoginDialog
          hrefs={hrefs}
          onClose={() => {
            setLoginReturn(null);
          }}
        />
      )}
    </SessionContext.Provider>
  );
}

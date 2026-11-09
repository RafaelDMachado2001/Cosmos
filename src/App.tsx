import { Suspense, lazy, useLayoutEffect, useMemo } from 'react';

import { Announcer } from './components/Announcer/Announcer';
import { Shell } from './components/Shell/Shell';
import { parseRoute } from './core/routing';
import type { Route } from './core/routing';
import type { Locale } from './core/types';
import { createMembers } from './data/source';
import { LocaleProvider } from './i18n/LocaleProvider';
import { detachShell } from './prerenderShell';
import { SessionProvider } from './session/SessionProvider';

const AccountPage = lazy(() =>
  import('./components/AccountPage/AccountPage').then((module) => ({ default: module.AccountPage })),
);
const PrivacyPage = lazy(() =>
  import('./components/PrivacyPage/PrivacyPage').then((module) => ({ default: module.PrivacyPage })),
);

function routeLocale(route: Route): Locale | null {
  return route.kind === 'notfound' ? null : route.locale;
}

export default function App() {
  const route = useMemo(() => parseRoute(window.location.pathname), []);
  const initial = routeLocale(route);
  const members = useMemo(() => createMembers(), []);

  useLayoutEffect(() => {
    detachShell();
  }, []);

  return (
    <LocaleProvider {...(initial === null ? {} : { initial })}>
      <Announcer>
        <SessionProvider source={members} apiUrl={__API_URL__}>
          {route.kind === 'account' ? (
            <Suspense fallback={null}>
              <AccountPage />
            </Suspense>
          ) : route.kind === 'privacy' ? (
            <Suspense fallback={null}>
              <PrivacyPage />
            </Suspense>
          ) : (
            <Shell route={route} />
          )}
        </SessionProvider>
      </Announcer>
    </LocaleProvider>
  );
}

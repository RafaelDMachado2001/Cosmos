import { useLayoutEffect, useMemo } from 'react';

import { Shell } from './components/Shell/Shell';
import { parseRoute } from './core/routing';
import type { Route } from './core/routing';
import type { Locale } from './core/types';
import { LocaleProvider } from './i18n/LocaleProvider';
import { detachShell } from './prerenderShell';

function routeLocale(route: Route): Locale | null {
  return route.kind === 'notfound' ? null : route.locale;
}

export default function App() {
  const route = useMemo(() => parseRoute(window.location.pathname), []);
  const initial = routeLocale(route);

  useLayoutEffect(() => {
    detachShell();
  }, []);

  return (
    <LocaleProvider {...(initial === null ? {} : { initial })}>
      <Shell route={route} />
    </LocaleProvider>
  );
}

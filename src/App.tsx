import { useLayoutEffect, useMemo } from 'react';

import { Shell } from './components/Shell/Shell';
import { parseRoute } from './core/routing';
import type { Route } from './core/routing';
import type { Locale } from './core/types';
import { LocaleProvider } from './i18n/LocaleProvider';
import { detachShell } from './prerenderShell';

/** O idioma que a rota fixa, ou `null` quando a URL não o diz. */
function routeLocale(route: Route): Locale | null {
  return route.kind === 'notfound' ? null : route.locale;
}

export default function App() {
  /**
   * A URL da carga, lida uma única vez.
   *
   * Depois disto quem manda no endereço é o histórico, e reler `location` a
   * cada render traria de volta a rota de origem depois de o leitor já ter
   * navegado para outra.
   */
  const route = useMemo(() => parseRoute(window.location.pathname), []);
  const initial = routeLocale(route);

  /*
   * A casca sai depois do primeiro commit bem-sucedido, não antes: se o React
   * quebrar na montagem, ela precisa continuar lá (ver `ErrorBoundary`). Sai
   * do DOM, com lugar guardado para voltar (`prerenderShell.ts`). Layout
   * effect porque roda antes da pintura: com o efeito comum haveria um quadro
   * com a casca e a constelação na tela ao mesmo tempo.
   */
  useLayoutEffect(() => {
    detachShell();
  }, []);

  return (
    // Numa carga direta de /en/publications/... a URL manda no idioma, não a
    // preferência salva: o link foi compartilhado naquela língua.
    <LocaleProvider {...(initial === null ? {} : { initial })}>
      <Shell route={route} />
    </LocaleProvider>
  );
}

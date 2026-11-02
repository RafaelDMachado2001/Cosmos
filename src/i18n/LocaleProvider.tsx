import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { LocaleContext } from './LocaleContext';
import type { LocaleValue } from './LocaleContext';
import { DICTIONARIES } from './dictionaries';
import { DEFAULT_LOCALE, STORAGE_KEY, isLocale } from './types';
import type { Locale } from './types';

function readStoredLocale(): Locale {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
  }
  const prefix = window.navigator.language.slice(0, 2);
  return isLocale(prefix) ? prefix : DEFAULT_LOCALE;
}

export function LocaleProvider({
  children,
  initial,
}: {
  children: ReactNode;
  initial?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(() => initial ?? readStoredLocale());

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
    }
  }, []);

  const t = DICTIONARIES[locale];

  const value = useMemo<LocaleValue>(() => ({ locale, t, setLocale }), [locale, t, setLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { LocaleContext } from './LocaleContext';
import type { LocaleValue } from './LocaleContext';
import { DICTIONARIES } from './dictionaries';
import { DEFAULT_LOCALE, STORAGE_KEY, isLocale } from './types';
import type { Locale } from './types';

/** localStorage lança em modo privado em alguns navegadores; nunca deixar quebrar o boot. */
function readStoredLocale(): Locale {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    /* sem armazenamento: cai para o idioma do navegador */
  }
  const prefix = window.navigator.language.slice(0, 2);
  return isLocale(prefix) ? prefix : DEFAULT_LOCALE;
}

export function LocaleProvider({
  children,
  initial,
}: {
  children: ReactNode;
  /** Numa carga direta de /en/publications/... a URL manda, não o armazenamento. */
  initial?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(() => initial ?? readStoredLocale());

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* preferência não persistida: não é motivo para falhar */
    }
  }, []);

  const t = DICTIONARIES[locale];

  useEffect(() => {
    document.documentElement.lang = t.meta.localeTag;
    document.title = t.meta.title;
  }, [t]);

  const value = useMemo<LocaleValue>(() => ({ locale, t, setLocale }), [locale, t, setLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

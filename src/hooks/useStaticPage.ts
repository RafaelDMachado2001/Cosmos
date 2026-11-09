import { useEffect, useRef } from 'react';

import type { Locale } from '../core/types';
import { useLocale } from '../i18n/useLocale';

export function useStaticPage(pathFor: (locale: Locale) => string, title: string): void {
  const { locale, t } = useLocale();
  const firstRef = useRef(true);

  useEffect(() => {
    document.documentElement.lang = t.meta.localeTag;
    document.title = `${title} · ${t.meta.title}`;
    if (firstRef.current) {
      firstRef.current = false;
      return;
    }
    const { search, hash } = window.location;
    window.history.replaceState(window.history.state, '', `${pathFor(locale)}${search}${hash}`);
  }, [locale, t, title, pathFor]);
}

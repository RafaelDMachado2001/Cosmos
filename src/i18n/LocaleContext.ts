import { createContext } from 'react';
import type { Dictionary } from './pt';
import type { Locale } from './types';

export interface LocaleValue {
  readonly locale: Locale;
  readonly t: Dictionary;
  readonly setLocale: (next: Locale) => void;
}

export const LocaleContext = createContext<LocaleValue | null>(null);

import { createContext } from 'react';
import type { Dictionary } from './pt';
import type { Locale } from './types';

export interface LocaleValue {
  readonly locale: Locale;
  readonly t: Dictionary;
  readonly setLocale: (next: Locale) => void;
}

// Contexto sozinho num arquivo: manter componentes fora daqui preserva o fast refresh.
export const LocaleContext = createContext<LocaleValue | null>(null);

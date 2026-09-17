import { DEFAULT_LOCALE, LOCALES, isLocale } from '../core/types';
import type { Locale } from '../core/types';

// O idioma é do domínio (o conteúdo é bilíngue), não da camada de tradução.
export { DEFAULT_LOCALE, LOCALES, isLocale };
export type { Locale };

export const STORAGE_KEY = 'rdm:cosmos:locale';

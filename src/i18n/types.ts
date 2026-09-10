import { LOCALES } from '../core/types';
import type { Locale } from '../core/types';

// O idioma é do domínio (o conteúdo é bilíngue), não da camada de tradução.
export { LOCALES };
export type { Locale };

export const DEFAULT_LOCALE: Locale = 'pt';

export const STORAGE_KEY = 'rdm:cosmos:locale';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

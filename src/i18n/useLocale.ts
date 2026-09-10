import { useContext } from 'react';
import { LocaleContext } from './LocaleContext';
import type { LocaleValue } from './LocaleContext';

export function useLocale(): LocaleValue {
  const value = useContext(LocaleContext);
  if (!value) throw new Error('useLocale precisa estar dentro de <LocaleProvider>');
  return value;
}

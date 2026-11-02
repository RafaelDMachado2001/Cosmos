import type { Locale } from './types';

const DATE_LOCALE: Record<Locale, string> = { pt: 'pt-BR', en: 'en-GB' };

export function monthYearLabel(timestamp: number, locale: Locale): string {
  return new Intl.DateTimeFormat(DATE_LOCALE[locale], {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
    .formatToParts(new Date(timestamp))
    .filter((part) => part.type === 'month' || part.type === 'year')
    .map((part) => part.value.replace(/\./g, ''))
    .join(' ')
    .toUpperCase();
}

export function monthLabel(timestamp: number, locale: Locale): string {
  return new Intl.DateTimeFormat(DATE_LOCALE[locale], { month: 'short', timeZone: 'UTC' })
    .format(new Date(timestamp))
    .replace(/\./g, '')
    .toUpperCase();
}

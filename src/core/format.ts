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

export function fill(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

export function countLabel(value: number, locale: Locale): string {
  return new Intl.NumberFormat(DATE_LOCALE[locale]).format(value);
}

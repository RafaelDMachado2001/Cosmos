/**
 * Como uma data é escrita na interface.
 *
 * Vive no core porque três lugares precisam produzir exatamente a mesma linha:
 * a constelação, a vista de leitura e o HTML que o prerender grava no build. Se
 * o servidor escrever uma data e o React outra, o texto pisca na primeira
 * renderização — e a busca, que varre o rótulo da data, deixa de achar o que o
 * leitor vê escrito.
 *
 * Módulo puro: sem DOM, sem React, sem Three.
 */

import type { Locale } from './types';

/** O locale de formatação. `en-GB` porque o dia vem antes do mês. */
const DATE_LOCALE: Record<Locale, string> = { pt: 'pt-BR', en: 'en-GB' };

/**
 * `SET 2025`.
 *
 * Montado a partir das partes em vez do texto pronto: `pt-BR` devolve
 * "set. de 2025", com uma preposição no meio que o handoff não pede e uma
 * abreviação com ponto. Filtrar as partes tira as duas sem depender de como
 * cada idioma decide unir mês e ano.
 *
 * O fuso é fixo em UTC pelo mesmo motivo que `publishedAt` é interpretado em
 * UTC: a data de uma publicação não muda conforme quem a lê.
 */
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

/** `FEV`: o marcador mensal da régua. Mesmas regras de `monthYearLabel`. */
export function monthLabel(timestamp: number, locale: Locale): string {
  return new Intl.DateTimeFormat(DATE_LOCALE[locale], { month: 'short', timeZone: 'UTC' })
    .format(new Date(timestamp))
    .replace(/\./g, '')
    .toUpperCase();
}

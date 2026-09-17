import type { MetaSite } from './core/seo';

/**
 * Quem é o site, para o cabeçalho de cada página.
 *
 * A origem vem do `.env` e é assada no bundle: trocar de domínio exige rebuild,
 * porque o canonical e o sitemap são absolutos e precisam apontar para onde o
 * site realmente está.
 */
export const SITE: MetaSite = {
  origin: __SITE_ORIGIN__,
  siteName: 'RDM Labs',
  authorName: 'Rafael Dorneles Machado',
};

import { LOCALE_TAG } from '../core/types';
import type { Dictionary } from './pt';

export const en: Dictionary = {
  meta: {
    localeTag: LOCALE_TAG.en,
    title: 'RDM Labs · Cosmos',
    description:
      'Articles, studies, projects and field notes arranged as a timeline constellation.',
  },
  hero: {
    kicker: 'RDM LABS / COSMOS',
    title: 'Enter my universe',
    subtitle: 'Articles, studies, projects and field notes arranged as a timeline constellation.',
    scrollHint: 'Scroll to pass through',
  },
  nav: {
    brand: 'RDM LABS',
    home: 'START',
    cosmos: 'CONSTELLATION',
    categories: 'CATEGORIES',
    portfolio: 'PORTFOLIO',
    /** Distingue este landmark dos outros `nav` da página. */
    primaryLabel: 'Main navigation',
    skipToContent: 'Skip to content',
    localeLabel: 'Language',
    /** O outro idioma, nomeado na língua dele. */
    otherLocale: 'PORTUGUÊS',
    otherLocaleTag: 'pt-BR',
  },
  search: {
    placeholder: 'search the cosmos…',
    label: 'Search the cosmos',
  },
  ruler: {
    past: 'PAST',
    now: 'TODAY',
    dragHint: 'DRAG OR SCROLL',
    label: 'Scrub the timeline',
  },
  star: {
    openHint: 'CLICK TO OPEN',
    tapHint: 'TAP AGAIN TO OPEN',
    indexLabel: 'All publications',
  },
  reader: {
    back: 'BACK TO CONSTELLATION',
    close: 'Close and return to the constellation',
  },
  categories: {
    filterBy: 'FILTER BY CATEGORY',
    all: 'All',
    artigo: 'Technical article',
    projeto: 'Project',
    estudo: 'Study',
    rotina: 'Field notes',
  },
  loading: {
    title: 'MAPPING THE COSMOS',
    subtitle: 'Fetching the publications.',
  },
  empty: {
    title: 'NO STARS FOUND',
    subtitle: 'Adjust the search or clear the category filter.',
  },
  notFound: {
    title: 'THIS STAR DOES NOT EXIST',
    subtitle: 'That address matches no publication in the archive.',
    back: 'VIEW THE CONSTELLATION',
  },
  error: {
    title: 'COULD NOT LOAD THE COSMOS',
    subtitle: 'Something failed while fetching the publications.',
    retry: 'TRY AGAIN',
  },
};

import { en } from './en';
import { pt } from './pt';
import type { Dictionary } from './pt';
import type { Locale } from './types';

export const DICTIONARIES: Record<Locale, Dictionary> = { pt, en };

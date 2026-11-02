import type { Category } from '../core/types';

export const CATEGORY_LABEL: Record<Category, string> = {
  artigo: 'Artigo técnico',
  projeto: 'Projeto',
  estudo: 'Estudo',
  rotina: 'Rotina',
};

export const STATUS_LABEL = {
  draft: 'Rascunho',
  scheduled: 'Agendada',
  published: 'Publicada',
} as const;

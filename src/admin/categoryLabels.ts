import type { Category } from '../core/types';

/** Rótulos em português — o mesmo texto do Filament (`PublicationForm.php`). O RDM Studio é só em PT. */
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

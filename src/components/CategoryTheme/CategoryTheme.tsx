import type { ReactNode } from 'react';

import { categoryThemeStyle } from './themeStyle';
import type { Category } from '../../core/types';

export interface CategoryThemeProps {
  readonly category: Category;
  readonly className?: string;
  readonly children: ReactNode;
}

/**
 * Põe a paleta da categoria em `--cat`, `--n1`, `--n2`, `--n3` e `--warm`
 * para tudo o que está dentro. Os componentes da leitura só leem essas
 * variáveis; nenhum conhece a cor de uma categoria. Os valores vêm de
 * `tokens.css`, a única fonte das cores.
 */
export function CategoryTheme({ category, className, children }: CategoryThemeProps) {
  return (
    <div className={className} style={categoryThemeStyle(category)} data-category={category}>
      {children}
    </div>
  );
}

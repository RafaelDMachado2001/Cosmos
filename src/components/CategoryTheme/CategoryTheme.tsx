import type { CSSProperties, ReactNode } from 'react';

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
  const style = {
    '--cat': `var(--color-cat-${category})`,
    '--n1': `var(--color-cat-${category}-n1)`,
    '--n2': `var(--color-cat-${category}-n2)`,
    '--n3': `var(--color-cat-${category}-n3)`,
    '--warm': `var(--color-cat-${category}-warm)`,
  } as CSSProperties;

  return (
    <div className={className} style={style} data-category={category}>
      {children}
    </div>
  );
}

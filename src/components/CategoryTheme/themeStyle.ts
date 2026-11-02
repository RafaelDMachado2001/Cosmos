import type { CSSProperties } from 'react';

import type { Category } from '../../core/types';

export function categoryThemeStyle(category: Category): CSSProperties {
  return {
    '--cat': `var(--color-cat-${category})`,
    '--n1': `var(--color-cat-${category}-n1)`,
    '--n2': `var(--color-cat-${category}-n2)`,
    '--n3': `var(--color-cat-${category}-n3)`,
    '--warm': `var(--color-cat-${category}-warm)`,
  } as CSSProperties;
}

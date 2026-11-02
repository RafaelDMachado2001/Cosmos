import type { ReactNode } from 'react';

import { categoryThemeStyle } from './themeStyle';
import type { Category } from '../../core/types';

export interface CategoryThemeProps {
  readonly category: Category;
  readonly className?: string | undefined;
  readonly children: ReactNode;
}

export function CategoryTheme({ category, className, children }: CategoryThemeProps) {
  return (
    <div className={className} style={categoryThemeStyle(category)} data-category={category}>
      {children}
    </div>
  );
}

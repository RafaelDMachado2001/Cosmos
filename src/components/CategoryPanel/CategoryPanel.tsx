import styles from './CategoryPanel.module.css';
import { categoryRows } from '../../core/filter';
import type { CategoryCounts } from '../../core/filter';
import type { Category } from '../../core/types';
import { useLocale } from '../../i18n/useLocale';

export interface CategoryPanelProps {
  readonly open: boolean;
  readonly counts: CategoryCounts;
  readonly active: Category | 'all';
  readonly onPick: (category: Category | 'all') => void;
}

/**
 * Filtro por categoria, ancorado abaixo do header.
 *
 * Clicar na categoria ativa remove o filtro — sem isso a única saída seria a
 * primeira linha, e o leitor que entrou por uma categoria teria de descobrir
 * que "Tudo" é um botão e não um rótulo.
 */
export function CategoryPanel({ open, counts, active, onPick }: CategoryPanelProps) {
  const { t } = useLocale();
  const rows = categoryRows(counts, active);

  return (
    <div
      className={styles.panel}
      data-open={open}
      aria-hidden={!open}
      {...(open ? {} : { inert: '' })}
    >
      <p className={styles.heading}>{t.categories.filterBy}</p>

      {rows.map((key) => (
        <button
          key={key}
          type="button"
          className={styles.row}
          data-active={key === active}
          aria-pressed={key === active}
          onClick={() => {
            onPick(key === active ? 'all' : key);
          }}
        >
          <span
            className={styles.dot}
            style={{
              ['--dot-color' as string]:
                key === 'all' ? 'var(--color-accent)' : `var(--color-cat-${key})`,
            }}
            aria-hidden="true"
          />
          {t.categories[key]}
          <span className={styles.count}>{counts[key]}</span>
        </button>
      ))}
    </div>
  );
}

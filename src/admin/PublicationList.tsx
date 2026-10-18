import { useMemo, useState } from 'react';

import { CATEGORY_LABEL, STATUS_LABEL } from './categoryLabels';
import styles from './PublicationList.module.css';
import type { AdminPublication, PublicationStatus } from './api';

export interface PublicationListProps {
  readonly publications: readonly AdminPublication[];
  readonly selectedId: number | null;
  readonly onSelect: (id: number) => void;
  readonly onCreate: () => void;
}

type StatusFilter = PublicationStatus | 'all';

function titleOf(publication: AdminPublication): string {
  return publication.drafts.pt?.title ?? publication.drafts.en?.title ?? publication.slug;
}

export function PublicationList({
  publications,
  selectedId,
  onSelect,
  onCreate,
}: PublicationListProps): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return publications.filter((publication) => {
      if (status !== 'all' && publication.status !== status) return false;
      if (q === '') return true;
      return titleOf(publication).toLowerCase().includes(q) || publication.slug.includes(q);
    });
  }, [publications, query, status]);

  return (
    <div className={styles.column}>
      <div className={styles.header}>
        <h1 className={styles.title}>RDM Studio</h1>
        <button type="button" className={styles.createButton} onClick={onCreate}>
          + Nova
        </button>
      </div>

      <input
        type="search"
        placeholder="Buscar por título ou slug"
        className={styles.search}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      <div className={styles.filters} role="radiogroup" aria-label="Filtrar por situação">
        {(['all', 'draft', 'scheduled', 'published'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={status === value}
            className={status === value ? styles.filterActive : styles.filter}
            onClick={() => setStatus(value)}
          >
            {value === 'all' ? 'Todas' : STATUS_LABEL[value]}
          </button>
        ))}
      </div>

      <ul className={styles.list}>
        {filtered.map((publication) => (
          <li key={publication.id}>
            <button
              type="button"
              className={publication.id === selectedId ? styles.itemActive : styles.item}
              onClick={() => onSelect(publication.id)}
            >
              <span className={styles.itemTitle}>{titleOf(publication)}</span>
              <span className={styles.itemMeta}>
                <span className={styles[`pill_${publication.status}`]}>
                  {STATUS_LABEL[publication.status]}
                </span>
                <span>{CATEGORY_LABEL[publication.category]}</span>
              </span>
            </button>
          </li>
        ))}
        {filtered.length === 0 && <li className={styles.empty}>Nada encontrado.</li>}
      </ul>
    </div>
  );
}

import { useEffect, useState } from 'react';

import { slugify } from '../core/slug';
import styles from './TagInput.module.css';
import { api } from './api';

export interface TagInputProps {
  readonly tags: readonly string[];
  readonly onChange: (tags: readonly string[]) => void;
}

export function TagInput({ tags, onChange }: TagInputProps): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<readonly string[]>([]);

  useEffect(() => {
    const q = query.trim();
    if (q === '') {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    api
      .searchTags(q)
      .then((found) => {
        if (!cancelled) setSuggestions(found.filter((tag) => !tags.includes(tag)));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [query, tags]);

  function add(raw: string): void {
    const slug = slugify(raw);
    if (slug === '' || tags.includes(slug)) return;
    onChange([...tags, slug]);
    setQuery('');
    setSuggestions([]);
  }

  function remove(tag: string): void {
    onChange(tags.filter((current) => current !== tag));
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.chips}>
        {tags.map((tag) => (
          <button key={tag} type="button" className={styles.chip} onClick={() => remove(tag)}>
            {tag} ✕
          </button>
        ))}
      </div>
      <input
        type="text"
        className={styles.input}
        placeholder="Adicionar tag…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            add(query);
          }
        }}
      />
      {suggestions.length > 0 && (
        <ul className={styles.suggestions}>
          {suggestions.map((tag) => (
            <li key={tag}>
              <button type="button" onClick={() => add(tag)}>
                {tag}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import type { PublicationSummary } from '../../core/types';

export interface StarIndexProps {
  readonly items: readonly PublicationSummary[];
  readonly label: string;
  readonly hrefFor: (slug: string) => string;
}

export function StarIndex({ items, label, hrefFor }: StarIndexProps) {
  return (
    <nav className="visually-hidden" aria-label={label}>
      <ol>
        {items.map((item) => (
          <li key={item.slug}>
            <a href={hrefFor(item.slug)} tabIndex={-1}>
              {item.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

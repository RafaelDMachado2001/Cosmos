import { memo, useRef } from 'react';

import styles from './Star.module.css';
import type { PlacedStar } from '../../core/timeline';
import type { HoverVia } from '../HoverPanel/HoverPanel';

export interface StarCaption {
  readonly title: string;
  readonly date: string;
}

export interface StarProps {
  readonly star: PlacedStar;
  readonly yPx: number;
  readonly label: string;
  readonly caption: StarCaption;
  readonly href: string;
  readonly dimmed: boolean;
  readonly hovered: boolean;
  readonly revealDelay: number;
  readonly onActivate: (star: PlacedStar) => void;
  readonly onHover: (slug: string | null, via?: HoverVia) => void;
  readonly onFocusStar: (star: PlacedStar) => void;
}

export const Star = memo(function Star({
  star,
  yPx,
  label,
  caption,
  href,
  dimmed,
  hovered,
  revealDelay,
  onActivate,
  onHover,
  onFocusStar,
}: StarProps) {
  const press = useRef<{ touch: boolean; wasHovered: boolean }>({
    touch: false,
    wasHovered: false,
  });

  return (
    <a
      className={styles.hit}
      href={href}
      style={{
        left: `${star.x}px`,
        top: `${yPx}px`,
        ['--star-color' as string]: `var(--color-cat-${star.category})`,
        ['--reveal-delay' as string]: `${revealDelay}ms`,
      }}
      data-dimmed={dimmed}
      data-featured={star.featured}
      aria-label={label}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        const { touch, wasHovered } = press.current;
        press.current = { touch: false, wasHovered: false };
        if (touch && !wasHovered) {
          onHover(star.slug, 'touch');
          return;
        }
        onActivate(star);
      }}
      onPointerDown={(event) => {
        press.current = { touch: event.pointerType === 'touch', wasHovered: hovered };
      }}
      onPointerEnter={(event) => {
        if (event.pointerType !== 'touch') onHover(star.slug);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== 'touch') onHover(null);
      }}
      onFocus={() => {
        onFocusStar(star);
        onHover(star.slug);
      }}
      onBlur={() => {
        onHover(null);
      }}
    >
      <span className={styles.core} aria-hidden="true" />
      <span className={styles.ring} aria-hidden="true" />
      <span className={styles.caption} aria-hidden="true">
        <span className={styles.captionTitle}>{caption.title}</span>
        <span className={styles.captionDate}>{caption.date}</span>
      </span>
    </a>
  );
});

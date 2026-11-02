import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

const READING_LINE = 0.38;

export function useActiveHeading(ids: readonly string[], root: RefObject<HTMLElement>): string | null {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const container = root.current;
    if (!container || ids.length === 0) return;

    const headings = ids
      .map((id) => container.querySelector<HTMLElement>(`[id="${id}"]`))
      .filter((element): element is HTMLElement => element !== null);

    let frame = 0;
    const measure = (): void => {
      frame = 0;
      const box = container.getBoundingClientRect();
      const line = box.top + box.height * READING_LINE;
      let current: string | null = null;
      for (const heading of headings) {
        if (heading.getBoundingClientRect().top > line) break;
        current = heading.id;
      }
      setActive(current);
    };
    const onScroll = (): void => {
      if (frame === 0) frame = requestAnimationFrame(measure);
    };

    measure();
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', onScroll);
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, [ids, root]);

  return active;
}

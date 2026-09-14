import { memo } from 'react';

import styles from './Star.module.css';
import type { PlacedStar } from '../../core/timeline';

export interface StarProps {
  readonly star: PlacedStar;
  readonly yPx: number;
  readonly label: string;
  readonly href: string;
  readonly dimmed: boolean;
  readonly onActivate: (star: PlacedStar) => void;
  readonly onHover: (slug: string | null) => void;
}

/**
 * Uma estrela.
 *
 * É uma âncora real, com href: rastreável, abre em nova aba com o botão do
 * meio e alcançável por Tab. O `content-visibility` faz o navegador pular
 * layout e pintura fora da tela sem tirar nada do DOM — a virtualização por
 * desmontagem só entra acima de algumas centenas de publicações.
 *
 * Memoizada porque o cartão de hover é estado do React: sem isso, passar o
 * ponteiro por uma estrela re-renderizaria a constelação inteira.
 */
export const Star = memo(function Star({
  star,
  yPx,
  label,
  href,
  dimmed,
  onActivate,
  onHover,
}: StarProps) {
  return (
    <a
      className={styles.hit}
      href={href}
      style={{
        left: `${star.x}px`,
        top: `${yPx}px`,
        ['--star-color' as string]: `var(--color-cat-${star.category})`,
      }}
      data-dimmed={dimmed}
      data-featured={star.featured}
      aria-label={label}
      onClick={(event) => {
        // Clique simples com o botão esquerdo abre no lugar; o resto
        // (ctrl, meio, nova aba) segue o comportamento nativo do link.
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        onActivate(star);
      }}
      onPointerEnter={() => {
        onHover(star.slug);
      }}
      onPointerLeave={() => {
        onHover(null);
      }}
      onFocus={() => {
        onHover(star.slug);
      }}
      onBlur={() => {
        onHover(null);
      }}
    >
      <span className={styles.core} aria-hidden="true" />
      <span className={styles.ring} aria-hidden="true" />
    </a>
  );
});

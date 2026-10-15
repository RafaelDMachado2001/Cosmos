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
  /** Rótulo visível: título curto e data. Repete o `label`, por isso aria-hidden. */
  readonly caption: StarCaption;
  readonly href: string;
  readonly dimmed: boolean;
  /** Se o painel desta estrela está aberto. Decide o segundo toque. */
  readonly hovered: boolean;
  /** Atraso do fade de entrada, em ms. Ver `revealDelayMs`. */
  readonly revealDelay: number;
  readonly onActivate: (star: PlacedStar) => void;
  readonly onHover: (slug: string | null, via?: HoverVia) => void;
  /** Só pelo teclado: a câmera precisa acompanhar para onde o foco foi. */
  readonly onFocusStar: (star: PlacedStar) => void;
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
  caption,
  href,
  dimmed,
  hovered,
  revealDelay,
  onActivate,
  onHover,
  onFocusStar,
}: StarProps) {
  /*
   * O que o ponteiro era ao pressionar, e se o painel já estava aberto. Lido
   * no pointerdown porque o clique chega depois do foco, que já abre o painel.
   */
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
        // Clique simples com o botão esquerdo abre no lugar; o resto
        // (ctrl, meio, nova aba) segue o comportamento nativo do link.
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        const { touch, wasHovered } = press.current;
        press.current = { touch: false, wasHovered: false };
        // No toque não há hover: o primeiro toque faz o papel dele, mostrando
        // o painel, e só o segundo na mesma estrela abre o artigo.
        if (touch && !wasHovered) {
          onHover(star.slug, 'touch');
          return;
        }
        onActivate(star);
      }}
      onPointerDown={(event) => {
        press.current = { touch: event.pointerType === 'touch', wasHovered: hovered };
      }}
      // O toque dispara enter e leave em volta de cada toque; deixá-los mexer
      // no painel o abriria e fecharia antes do clique decidir.
      onPointerEnter={(event) => {
        if (event.pointerType !== 'touch') onHover(star.slug);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== 'touch') onHover(null);
      }}
      onFocus={() => {
        onHover(star.slug);
        // Sem isto o Tab levava o foco para estrelas fora do enquadramento: o
        // anel de foco existia, mas do lado de fora da tela.
        onFocusStar(star);
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

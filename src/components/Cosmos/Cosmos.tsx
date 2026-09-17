import { forwardRef, useMemo } from 'react';
import type { RefObject } from 'react';

import styles from './Cosmos.module.css';
import { revealDelayMs } from '../../core/collection';
import {
  AXIS_PCT,
  connectors,
  resolveBand,
  strandExtent,
  visibleRange,
  yPx,
  yearMarkers,
} from '../../core/timeline';
import type { PlacedStar } from '../../core/timeline';
import type { Viewport } from '../../core/types';
import { HoverPanel } from '../HoverPanel/HoverPanel';
import type { HoverCard } from '../HoverPanel/HoverPanel';
import { Star } from '../Star/Star';

/** Acima disto as estrelas fora da janela deixam de ser montadas. */
const VIRTUALIZE_ABOVE = 800;

export interface CosmosProps {
  readonly stars: readonly PlacedStar[];
  readonly layerRef: RefObject<HTMLDivElement>;
  readonly viewport: Viewport;
  readonly pan: number;
  readonly marginPx: number;
  readonly labelFor: (star: PlacedStar) => string;
  readonly hrefFor: (slug: string) => string;
  readonly dimmed: ReadonlySet<string>;
  readonly reducedMotion: boolean;
  /** Cartão da estrela sob o ponteiro, ou nulo. */
  readonly hover: HoverCard | null;
  readonly onActivate: (star: PlacedStar) => void;
  readonly onHover: (slug: string | null) => void;
  readonly onFocusStar: (star: PlacedStar) => void;
  readonly onPointerDown: (event: React.PointerEvent) => void;
  /**
   * Falso na tela de entrada, onde a constelação está invisível.
   *
   * Invisível não basta: sem isto o Tab, a partir do hero, caminhava por
   * catorze âncoras que ninguém podia ver. Mesmo tratamento que a navegação
   * do header já recebia.
   */
  readonly interactive: boolean;
}

/**
 * A constelação: HTML posicionado por transform, nunca canvas.
 *
 * É o que garante que cada estrela seja um link real, focável e rastreável —
 * a camada 3D complementa o conteúdo, jamais o esconde.
 */
export const Cosmos = forwardRef<HTMLDivElement, CosmosProps>(function Cosmos(
  {
    stars,
    layerRef,
    viewport,
    pan,
    marginPx,
    labelFor,
    hrefFor,
    dimmed,
    reducedMotion,
    hover,
    onActivate,
    onHover,
    onFocusStar,
    onPointerDown,
    interactive,
  },
  ref,
) {
  const band = useMemo(() => resolveBand(viewport), [viewport]);
  const extent = useMemo(() => strandExtent(stars), [stars]);
  const links = useMemo(() => connectors(stars, band), [stars, band]);
  const years = useMemo(() => yearMarkers(stars), [stars]);

  // Acima do limiar, monta só a janela. Abaixo dele, content-visibility já
  // resolve o custo e manter tudo no DOM preserva a ordem de Tab sem truque.
  const window_ = useMemo(() => {
    if (stars.length <= VIRTUALIZE_ABOVE) return { start: 0, end: stars.length };
    return visibleRange(
      stars.map((star) => star.x),
      pan,
      viewport.width,
      marginPx,
    );
  }, [stars, pan, viewport.width, marginPx]);

  const visibleStars = stars.slice(window_.start, window_.end);
  const hoveredStar = hover === null ? undefined : stars.find((star) => star.slug === hover.slug);
  // Um conector a mais de cada lado: as arestas que entram e saem da janela.
  const visibleLinks = links.slice(Math.max(0, window_.start - 1), window_.end);

  return (
    <div
      ref={ref}
      className={styles.cosmos}
      onPointerDown={onPointerDown}
      aria-hidden={!interactive}
      {...(interactive ? {} : { inert: '' })}
    >
      <div ref={layerRef} className={styles.layer}>
        <div
          className={styles.axis}
          style={{
            left: `${extent.minX}px`,
            width: `${extent.widthPx}px`,
            top: `${AXIS_PCT * 100}%`,
          }}
          aria-hidden="true"
        />

        {visibleLinks.map((link) => (
          <div
            key={`${link.fromSlug}-${link.toSlug}`}
            className={styles.link}
            style={{
              left: `${link.x}px`,
              top: `${link.y}px`,
              width: `${link.lengthPx}px`,
              transform: `rotate(${link.angleDeg}deg)`,
            }}
            aria-hidden="true"
          />
        ))}

        {years.map((marker) => (
          <div
            key={marker.year}
            className={styles.year}
            style={{ left: `${marker.x}px` }}
            aria-hidden="true"
          >
            {marker.year}
          </div>
        ))}

        {visibleStars.map((star) => (
          <Star
            key={star.slug}
            star={star}
            yPx={yPx(star, band)}
            label={labelFor(star)}
            href={hrefFor(star.slug)}
            dimmed={dimmed.has(star.slug)}
            revealDelay={revealDelayMs(star.index, reducedMotion)}
            onActivate={onActivate}
            onHover={onHover}
            onFocusStar={onFocusStar}
          />
        ))}

        {/* Depois das estrelas: sem z-index, quem vem por último pinta por cima. */}
        {hover && hoveredStar && (
          <HoverPanel
            card={hover}
            category={hoveredStar.category}
            x={hoveredStar.x}
            yPx={yPx(hoveredStar, band)}
          />
        )}
      </div>
    </div>
  );
});

import { forwardRef, useMemo } from 'react';
import type { RefObject } from 'react';

import styles from './Cosmos.module.css';
import { giantYearX } from '../../core/atmosphere';
import { revealDelayMs } from '../../core/collection';
import { hoverDocked } from '../../core/reader';
import { monthLabel, monthYearLabel } from '../../core/format';
import {
  AXIS_PCT,
  connectors,
  monthMarkers,
  occludedMonths,
  resolveBand,
  strandExtent,
  visibleRange,
  yPx,
  yearMarkers,
} from '../../core/geometry';
import type { PlacedStar } from '../../core/timeline';
import type { Viewport } from '../../core/types';
import { useLocale } from '../../i18n/useLocale';
import { HoverPanel } from '../HoverPanel/HoverPanel';
import type { HoverCard, HoverVia } from '../HoverPanel/HoverPanel';
import { Star } from '../Star/Star';
import type { StarCaption } from '../Star/Star';

const VIRTUALIZE_ABOVE = 800;

export interface CosmosProps {
  readonly stars: readonly PlacedStar[];
  readonly layerRef: RefObject<HTMLDivElement>;
  readonly yearsRef: RefObject<HTMLDivElement>;
  readonly viewport: Viewport;
  readonly pan: number;
  readonly marginPx: number;
  readonly labelFor: (star: PlacedStar) => string;
  readonly captionFor: (star: PlacedStar) => StarCaption;
  readonly hrefFor: (slug: string) => string;
  readonly dimmed: ReadonlySet<string>;
  readonly reducedMotion: boolean;
  readonly hover: HoverCard | null;
  readonly onActivate: (star: PlacedStar) => void;
  readonly onHover: (slug: string | null, via?: HoverVia) => void;
  readonly onFocusStar: (star: PlacedStar) => void;
  readonly onPointerDown: (event: React.PointerEvent) => void;
  readonly interactive: boolean;
}

export const Cosmos = forwardRef<HTMLDivElement, CosmosProps>(function Cosmos(
  {
    stars,
    layerRef,
    yearsRef,
    viewport,
    pan,
    marginPx,
    labelFor,
    captionFor,
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
  const months = useMemo(() => monthMarkers(stars), [stars]);
  const hiddenMonths = useMemo(
    () => occludedMonths(months, stars, band, viewport.height * AXIS_PCT),
    [months, stars, band, viewport.height],
  );
  const { locale } = useLocale();
  const docked = hoverDocked(viewport.width);

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
  const visibleLinks = links.slice(Math.max(0, window_.start - 1), window_.end);

  return (
    <div
      ref={ref}
      className={styles.cosmos}
      onPointerDown={(event) => {
        if (
          event.pointerType === 'touch' &&
          hover !== null &&
          !(event.target instanceof Element && event.target.closest('a'))
        ) {
          onHover(null);
        }
        onPointerDown(event);
      }}
      onDragStart={(event) => {
        event.preventDefault();
      }}
      aria-hidden={!interactive}
      {...(interactive ? {} : { inert: '' })}
    >
      <div ref={yearsRef} className={styles.giantYears} aria-hidden="true">
        {years.map((marker) => (
          <span
            key={marker.year}
            className={styles.giantYear}
            style={{ left: `${giantYearX(marker.x)}px` }}
          >
            {marker.year}
          </span>
        ))}
      </div>

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

        {months.map((marker) => (
          <div
            key={marker.key}
            className={styles.month}
            style={{ left: `${marker.x}px`, top: `${AXIS_PCT * 100}%` }}
            data-january={marker.january}
            data-active={marker.hasPublication}
            aria-hidden="true"
          >
            {hiddenMonths.has(marker.key) ? null : marker.withYear
              ? monthYearLabel(marker.timestamp, locale)
              : monthLabel(marker.timestamp, locale)}
          </div>
        ))}

        {visibleStars.map((star) => (
          <Star
            key={star.slug}
            star={star}
            yPx={yPx(star, band)}
            label={labelFor(star)}
            caption={captionFor(star)}
            href={hrefFor(star.slug)}
            dimmed={dimmed.has(star.slug)}
            hovered={hover?.slug === star.slug}
            revealDelay={revealDelayMs(star.index, reducedMotion)}
            onActivate={onActivate}
            onHover={onHover}
            onFocusStar={onFocusStar}
          />
        ))}

        {hover && hoveredStar && !docked && (
          <HoverPanel
            card={hover}
            category={hoveredStar.category}
            x={hoveredStar.x}
            yPx={yPx(hoveredStar, band)}
          />
        )}
      </div>

      {hover && hoveredStar && docked && (
        <HoverPanel
          card={hover}
          category={hoveredStar.category}
          x={hoveredStar.x}
          yPx={yPx(hoveredStar, band)}
          dock={
            yPx(hoveredStar, band) > viewport.height / 2
              ? { edge: 'top', offsetPx: viewport.headerPx + 8 }
              : { edge: 'bottom', offsetPx: viewport.rulerPx + 24 }
          }
        />
      )}
    </div>
  );
});

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { resolveAppearance } from '../../core/appearance';
import { OPEN_DELAY_MS } from '../../core/motion';
import { needsSlide } from '../../core/navigation';
import {
  CLOSED,
  close as closeReaderState,
  hoverSide,
  isMounted,
  landed,
  mounted,
  open as openReaderState,
  settled,
} from '../../core/reader';
import type { HoverSide, ReaderState } from '../../core/reader';
import { articlePath, closeTarget, homePath, parseRoute, privacyPath } from '../../core/routing';
import type { Route } from '../../core/routing';
import { placeStars } from '../../core/timeline';
import type { PlacedStar } from '../../core/timeline';
import type { Viewport } from '../../core/types';
import { createSnapshot, createSource } from '../../data/source';
import { useConstellationFilter } from '../../hooks/useConstellationFilter';
import { useCosmosEngine } from '../../hooks/useCosmosEngine';
import { usePageHead } from '../../hooks/usePageHead';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { useArticle, usePublications } from '../../hooks/usePublications';
import { useStarLookup } from '../../hooks/useStarLookup';
import { useViewport } from '../../hooks/useViewport';
import { useLocale } from '../../i18n/useLocale';
import { Backdrop } from '../Backdrop/Backdrop';
import { CategoryPanel } from '../CategoryPanel/CategoryPanel';
import { Cosmos } from '../Cosmos/Cosmos';
import { CosmosStatus } from '../CosmosStatus/CosmosStatus';
import type { CosmosStatusKind } from '../CosmosStatus/CosmosStatus';
import { Header } from '../Header/Header';
import { Hero } from '../Hero/Hero';
import type { HoverCard, HoverVia } from '../HoverPanel/HoverPanel';
import { ReaderView } from '../ReaderView/ReaderView';
import type { ReaderCard } from '../ReaderView/ReaderView';
import { SkipLink } from '../SkipLink/SkipLink';
import { StarIndex } from '../StarIndex/StarIndex';
import { TimeRuler } from '../TimeRuler/TimeRuler';
import styles from './Shell.module.css';

export function Shell({ route }: { route: Route }) {
  const reducedMotion = usePrefersReducedMotion();
  const { locale, t } = useLocale();

  const rootRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const heroBlockRef = useRef<HTMLDivElement>(null);
  const cosmosRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const yearsRef = useRef<HTMLDivElement>(null);
  const scrubRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<HTMLSpanElement>(null);
  const fallbackRef = useRef<HTMLDivElement>(null);
  const skyFallbackRef = useRef<HTMLDivElement>(null);
  const readerRef = useRef<HTMLDivElement>(null);

  const [hovered, setHovered] = useState<{
    slug: string;
    side: HoverSide;
    via: HoverVia;
  } | null>(null);
  const [reader, setReader] = useState<ReaderState>(CLOSED);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [notFound, setNotFound] = useState(route.kind === 'notfound');

  const returnFocusRef = useRef<HTMLElement | null>(null);

  const ownsEntryRef = useRef(false);

  const pendingSlugRef = useRef(route.kind === 'article' ? route.slug : null);

  const source = useMemo(() => createSource(), []);
  const snapshot = useMemo(() => createSnapshot(), []);
  const collection = usePublications(source, locale, snapshot);
  const summaries = collection.state.items;

  const stars = useMemo(() => placeStars(summaries), [summaries]);
  const { summaryBySlug, starBySlug, dateLabel, labelFor, captionFor } = useStarLookup(
    summaries,
    stars,
    locale,
    t,
  );

  const refs = useMemo(
    () => ({
      hero: heroBlockRef,
      cosmos: cosmosRef,
      layer: layerRef,
      years: yearsRef,
      scrub: scrubRef,
      marker: markerRef,
      rail: railRef,
      fallback: fallbackRef,
      skyFallback: skyFallbackRef,
      reader: readerRef,
    }),
    [],
  );

  const onReaderSettled = useCallback(() => {
    setReader(settled);
  }, []);

  const engine = useCosmosEngine(stars, refs, reducedMotion, {
    state: reader,
    onSettled: onReaderSettled,
  });
  const measuredViewport = useViewport(headerRef);

  const viewport: Viewport = useMemo(
    () => ({ ...measuredViewport, rulerPx: 58 }),
    [measuredViewport],
  );

  const hrefFor = useCallback((slug: string) => articlePath(locale, slug), [locale]);

  const { slideTo } = engine;
  const { query, setQuery, category, setCategory, dimmed, counts } = useConstellationFilter(
    summaries,
    stars,
    t,
    dateLabel,
    slideTo,
  );

  const onHover = useCallback(
    (slug: string | null, via: HoverVia = 'pointer') => {
      const star = slug === null ? undefined : starBySlug.get(slug);
      if (!star) {
        setHovered(null);
        return;
      }
      setHovered({
        slug: star.slug,
        side: hoverSide(star.x - engine.targetPan(), viewport.width),
        via,
      });
    },
    [starBySlug, engine, viewport.width],
  );

  const onFocusStar = useCallback(
    (star: PlacedStar) => {
      if (!needsSlide(star.x - engine.panRef.current, viewport.width)) return;
      engine.slideTo(star);
    },
    [engine, viewport.width],
  );

  const hoverCard = useMemo<HoverCard | null>(() => {
    if (hovered === null) return null;
    const item = summaryBySlug.get(hovered.slug);
    if (!item) return null;

    return {
      slug: item.slug,
      side: hovered.side,
      via: hovered.via,
      categoryLabel: t.categories[item.category],
      dateLabel: dateLabel(Date.parse(item.publishedAt)),
      title: item.title,
      summary: item.summary,
    };
  }, [hovered, summaryBySlug, t, dateLabel]);

  const onActivate = useCallback(
    (star: PlacedStar) => {
      if (engine.didDrag()) return;
      if (reader.phase !== 'closed') return;
      returnFocusRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setHovered(null);
      const originPan = engine.openStar(star);
      setReader((current) => openReaderState(current, star.slug, originPan));
      window.history.pushState(null, '', articlePath(locale, star.slug));
      ownsEntryRef.current = true;
      setNotFound(false);
    },
    [engine, reader.phase, locale],
  );

  const applyClose = useCallback(() => {
    if (reader.phase === 'closed' || reader.phase === 'closing') return;
    engine.closeReader(reader.originPan);
    setReader(closeReaderState);
  }, [engine, reader]);

  const closeReader = useCallback(() => {
    if (reader.phase === 'closed' || reader.phase === 'closing') return;
    const target = closeTarget(ownsEntryRef.current, locale);
    applyClose();
    if (target.kind === 'back') {
      window.history.back();
      return;
    }
    window.history.replaceState(null, '', target.path);
    ownsEntryRef.current = false;
  }, [applyClose, locale, reader.phase]);

  useEffect(() => {
    if (reader.phase !== 'opening') return;
    const delay = reducedMotion ? OPEN_DELAY_MS.reduced : OPEN_DELAY_MS.normal;
    const timer = window.setTimeout(() => {
      setReader(mounted);
    }, delay);
    return () => {
      window.clearTimeout(timer);
    };
  }, [reader.phase, reducedMotion]);

  useEffect(() => {
    if (reader.phase === 'closed') return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closeReader();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [reader.phase, closeReader]);

  useEffect(() => {
    if (reader.phase !== 'closed') return;
    const target = returnFocusRef.current;
    returnFocusRef.current = null;
    target?.focus();
  }, [reader.phase]);

  const { jumpTo } = engine;

  useEffect(() => {
    const slug = pendingSlugRef.current;
    if (slug === null || collection.state.status !== 'ready') return;
    pendingSlugRef.current = null;

    const star = stars.find((item) => item.slug === slug);
    jumpTo(star ?? null);
    if (!star) {
      setNotFound(true);
      return;
    }
    setReader((current) => landed(current, slug));
  }, [collection.state.status, stars, jumpTo]);

  useEffect(() => {
    if (route.kind !== 'notfound') return;
    jumpTo(null);
  }, [route.kind, jumpTo]);

  useEffect(() => {
    const onPopState = (): void => {
      const next = parseRoute(window.location.pathname);

      if (next.kind !== 'article') {
        setNotFound(next.kind === 'notfound');
        applyClose();
        return;
      }

      const star = stars.find((item) => item.slug === next.slug);
      if (!star) {
        applyClose();
        setNotFound(true);
        return;
      }

      setNotFound(false);
      ownsEntryRef.current = true;
      jumpTo(star);
      setReader((current) => landed(current, next.slug));
    };

    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }, [stars, jumpTo, applyClose]);

  const lastLocaleRef = useRef(locale);

  useEffect(() => {
    if (lastLocaleRef.current === locale) return;
    lastLocaleRef.current = locale;
    const openSlug = isMounted(reader) || reader.phase === 'opening' ? reader.slug : null;
    window.history.replaceState(
      null,
      '',
      openSlug === null ? homePath(locale) : articlePath(locale, openSlug),
    );
  }, [locale, reader]);

  const article = useArticle(source, reader.slug, locale);

  useEffect(() => {
    if (article.status !== 'missing') return;
    if (reader.phase === 'closed' || reader.phase === 'closing') return;
    closeReader();
  }, [article.status, reader.phase, closeReader]);

  const readerCard = useMemo<ReaderCard | null>(() => {
    if (!isMounted(reader) || article.status !== 'ready') return null;
    const { detail } = article;
    if (detail.slug !== reader.slug) return null;

    const date = dateLabel(Date.parse(detail.publishedAt));

    return {
      slug: detail.slug,
      category: detail.category,
      categoryLabel: t.categories[detail.category],
      dateLabel: date,
      title: detail.title,
      summary: detail.summary,
      body: detail.body,
      appearance: resolveAppearance(detail.appearance),
      tags: detail.tags,
    };
  }, [reader, article, dateLabel, t]);

  usePageHead(reader, article, locale, t, summaries);

  const focusRailOnCrossRef = useRef(false);

  const enterCosmos = useCallback(
    (skip: boolean) => {
      focusRailOnCrossRef.current = heroBlockRef.current?.contains(document.activeElement) ?? false;
      if (skip) engine.jumpTo(null);
      else engine.goCosmos();
    },
    [engine],
  );

  useEffect(() => {
    if (engine.phase !== 'cosmos' || !focusRailOnCrossRef.current) return;
    focusRailOnCrossRef.current = false;
    railRef.current?.focus({ preventScroll: true });
  }, [engine.phase]);

  const goHome = useCallback(() => {
    setCategoriesOpen(false);
    setNotFound(false);
    window.history.replaceState(null, '', homePath(locale));
    engine.goHome();
  }, [engine, locale]);

  const statusKind = useMemo<CosmosStatusKind | null>(() => {
    if (notFound) return 'notfound';
    if (collection.state.status === 'loading') return 'loading';
    if (collection.state.status === 'error') return 'error';
    if (stars.length === 0 || dimmed.size === stars.length) return 'empty';
    return null;
  }, [notFound, collection.state.status, stars.length, dimmed.size]);

  const onStatusAction = useCallback(() => {
    if (!notFound) {
      collection.retry();
      return;
    }
    setNotFound(false);
    window.history.replaceState(null, '', homePath(locale));
  }, [notFound, collection, locale]);

  useEffect(() => {
    if (!categoriesOpen || reader.phase !== 'closed') return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      setCategoriesOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [categoriesOpen, reader.phase]);

  return (
    <>
      <SkipLink />
      <div ref={rootRef} className={styles.stage}>
        <Backdrop
          rootRef={rootRef}
          headerRef={headerRef}
          textBlockRef={heroBlockRef}
          reducedMotion={reducedMotion}
          sceneRef={engine.sceneRef}
          fallbackRef={fallbackRef}
          skyFallbackRef={skyFallbackRef}
        />
        <div className={styles.vignette} aria-hidden="true" />

        <Cosmos
          ref={cosmosRef}
          layerRef={layerRef}
          yearsRef={yearsRef}
          stars={stars}
          viewport={viewport}
          pan={engine.panBucket * 512}
          marginPx={engine.marginPx}
          labelFor={labelFor}
          captionFor={captionFor}
          hrefFor={hrefFor}
          dimmed={dimmed}
          reducedMotion={reducedMotion}
          hover={hoverCard}
          onActivate={onActivate}
          onHover={onHover}
          onFocusStar={onFocusStar}
          onPointerDown={engine.onCosmosPointerDown}
          interactive={engine.phase === 'cosmos'}
        />

        {statusKind !== null && engine.phase === 'cosmos' && (
          <CosmosStatus kind={statusKind} onAction={onStatusAction} />
        )}

        <Header
          ref={headerRef}
          phase={engine.phase}
          concealed={reader.phase !== 'closed'}
          query={query}
          categoriesOpen={categoriesOpen}
          onBrandClick={goHome}
          onQueryChange={setQuery}
          onToggleCategories={() => {
            setCategoriesOpen((open) => !open);
          }}
        />

        <CategoryPanel
          open={categoriesOpen && engine.phase === 'cosmos' && reader.phase === 'closed'}
          counts={counts}
          active={category}
          onPick={setCategory}
        />

        <main id="conteudo" className={styles.content} tabIndex={-1}>
          <Hero
            ref={heroBlockRef}
            onEnter={() => {
              enterCosmos(false);
            }}
            onSkip={() => {
              enterCosmos(true);
            }}
            active={engine.phase === 'hero'}
            heading={readerCard === null}
          />
          <StarIndex items={summaries} label={t.star.indexLabel} hrefFor={hrefFor} />
        </main>

        <a
          className={styles.privacy}
          href={privacyPath(locale)}
          data-visible={engine.phase === 'hero'}
          {...(engine.phase === 'hero' ? {} : { inert: '', 'aria-hidden': true })}
        >
          {t.footer.privacy}
        </a>

        <TimeRuler
          ref={scrubRef}
          railRef={railRef}
          markerRef={markerRef}
          onPointerDown={engine.onRailPointerDown}
        />

        {readerCard && (
          <ReaderView overlayRef={readerRef} card={readerCard} onClose={closeReader} />
        )}
      </div>
    </>
  );
}

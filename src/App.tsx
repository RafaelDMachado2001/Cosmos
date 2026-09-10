import { useCallback, useMemo, useRef, useState } from 'react';

import styles from './App.module.css';
import { Backdrop } from './components/Backdrop/Backdrop';
import { Cosmos } from './components/Cosmos/Cosmos';
import { Header } from './components/Header/Header';
import { Hero } from './components/Hero/Hero';
import { SkipLink } from './components/SkipLink/SkipLink';
import { StarIndex } from './components/StarIndex/StarIndex';
import { TimeRuler } from './components/TimeRuler/TimeRuler';
import { placeStars } from './core/timeline';
import type { PlacedStar } from './core/timeline';
import type { Viewport } from './core/types';
import { PUBLICATIONS } from './data/publications';
import { useCosmosEngine } from './hooks/useCosmosEngine';
import { usePrefersReducedMotion } from './hooks/usePrefersReducedMotion';
import { useViewport } from './hooks/useViewport';
import { LocaleProvider } from './i18n/LocaleProvider';
import { useLocale } from './i18n/useLocale';

/** Fase 6 assume as rotas; por ora o href já é o definitivo. */
const ARTICLE_SEGMENT = { pt: 'publicacoes', en: 'publications' } as const;

function Shell() {
  const reducedMotion = usePrefersReducedMotion();
  const { locale, t } = useLocale();

  const rootRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const heroBlockRef = useRef<HTMLDivElement>(null);
  const cosmosRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const scrubRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<HTMLSpanElement>(null);
  const fallbackRef = useRef<HTMLDivElement>(null);

  const [, setHovered] = useState<string | null>(null);

  const stars = useMemo(() => placeStars(PUBLICATIONS), []);
  const summaries = useMemo(
    () =>
      PUBLICATIONS.map((publication) => ({
        slug: publication.slug,
        publishedAt: publication.publishedAt,
        category: publication.category,
        title: publication.content[locale].title,
        summary: publication.content[locale].summary,
      })),
    [locale],
  );

  const refs = useMemo(
    () => ({
      hero: heroBlockRef,
      cosmos: cosmosRef,
      layer: layerRef,
      scrub: scrubRef,
      marker: markerRef,
      rail: railRef,
      fallback: fallbackRef,
    }),
    [],
  );

  const engine = useCosmosEngine(stars, refs, reducedMotion);
  const measuredViewport = useViewport(headerRef);

  const viewport: Viewport = useMemo(
    () => ({ ...measuredViewport, rulerPx: 58 }),
    [measuredViewport],
  );

  const hrefFor = useCallback(
    (slug: string) => `/${locale}/${ARTICLE_SEGMENT[locale]}/${slug}`,
    [locale],
  );

  const dateLabel = useCallback(
    (timestamp: number) =>
      new Date(timestamp)
        .toLocaleDateString(locale === 'pt' ? 'pt-BR' : 'en-GB', {
          month: 'short',
          year: 'numeric',
        })
        .replace('.', '')
        .toUpperCase(),
    [locale],
  );

  const labelFor = useCallback(
    (star: PlacedStar) => {
      const publication = PUBLICATIONS.find((item) => item.slug === star.slug);
      const title = publication?.content[locale].title ?? star.slug;
      return `${title} — ${t.categories[star.category]} — ${dateLabel(star.timestamp)}`;
    },
    [locale, t, dateLabel],
  );

  const onActivate = useCallback(
    (star: PlacedStar) => {
      // Fase 4 abre a vista de leitura; por ora a câmera apenas centraliza.
      if (engine.didDrag()) return;
      engine.focusStar(star);
    },
    [engine],
  );

  // Nenhuma estrela apagada até a fase 5, que traz busca e filtro.
  const dimmed = useMemo(() => new Set<string>(), []);

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
        />
        <div className={styles.vignette} aria-hidden="true" />

        <Cosmos
          ref={cosmosRef}
          layerRef={layerRef}
          stars={stars}
          viewport={viewport}
          pan={engine.panBucket * 512}
          marginPx={engine.marginPx}
          labelFor={labelFor}
          hrefFor={hrefFor}
          dimmed={dimmed}
          onActivate={onActivate}
          onHover={setHovered}
          onPointerDown={engine.onCosmosPointerDown}
        />

        <Header ref={headerRef} phase={engine.phase} onBrandClick={engine.goHome} />

        <main id="conteudo" className={styles.content} tabIndex={-1}>
          <Hero ref={heroBlockRef} onEnter={engine.goCosmos} />
          <StarIndex items={summaries} label={t.star.indexLabel} hrefFor={hrefFor} />
        </main>

        <TimeRuler
          ref={scrubRef}
          railRef={railRef}
          markerRef={markerRef}
          onPointerDown={engine.onRailPointerDown}
        />
      </div>
    </>
  );
}

export default function App() {
  return (
    <LocaleProvider>
      <Shell />
    </LocaleProvider>
  );
}

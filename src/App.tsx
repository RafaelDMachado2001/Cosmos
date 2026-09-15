import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import styles from './App.module.css';
import { Backdrop } from './components/Backdrop/Backdrop';
import { Cosmos } from './components/Cosmos/Cosmos';
import { Header } from './components/Header/Header';
import { Hero } from './components/Hero/Hero';
import { SkipLink } from './components/SkipLink/SkipLink';
import type { HoverCard } from './components/HoverPanel/HoverPanel';
import { ReaderView } from './components/ReaderView/ReaderView';
import type { ReaderCard } from './components/ReaderView/ReaderView';
import { StarIndex } from './components/StarIndex/StarIndex';
import { TimeRuler } from './components/TimeRuler/TimeRuler';
import { OPEN_DELAY_MS } from './core/motion';
import {
  CLOSED,
  close as closeReaderState,
  hoverSide,
  isMounted,
  mounted,
  open as openReaderState,
  settled,
  timelineLabel,
  timelinePosition,
} from './core/reader';
import type { HoverSide, ReaderState } from './core/reader';
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
  const readerRef = useRef<HTMLDivElement>(null);

  const [hovered, setHovered] = useState<{ slug: string; side: HoverSide } | null>(null);
  const [reader, setReader] = useState<ReaderState>(CLOSED);

  /** Quem tinha o foco quando o artigo abriu — para devolvê-lo ao fechar. */
  const returnFocusRef = useRef<HTMLElement | null>(null);

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

  /**
   * O lado do cartão é decidido uma vez, quando o ponteiro chega.
   *
   * O pan vive fora do React e muda a cada quadro; reavaliar o lado a cada um
   * deles custaria um segundo laço para reposicionar um cartão que, na prática,
   * some assim que a constelação se move sob o ponteiro.
   */
  const onHover = useCallback(
    (slug: string | null) => {
      const star = slug === null ? undefined : stars.find((item) => item.slug === slug);
      if (!star) {
        setHovered(null);
        return;
      }
      setHovered({
        slug: star.slug,
        side: hoverSide(star.x - engine.panRef.current, viewport.width),
      });
    },
    [stars, engine.panRef, viewport.width],
  );

  const hoverCard = useMemo<HoverCard | null>(() => {
    if (hovered === null) return null;
    const item = summaries.find((summary) => summary.slug === hovered.slug);
    if (!item) return null;

    return {
      slug: item.slug,
      side: hovered.side,
      categoryLabel: t.categories[item.category],
      dateLabel: dateLabel(Date.parse(item.publishedAt)),
      title: item.title,
      summary: item.summary,
    };
  }, [hovered, summaries, t, dateLabel]);

  const onActivate = useCallback(
    (star: PlacedStar) => {
      if (engine.didDrag()) return;
      // A câmera só se move se o estado for aceitar a abertura: deslocá-la
      // antes e ver `open` recusar deixaria o pan longe do que o fechamento
      // promete devolver.
      if (reader.phase !== 'closed') return;
      returnFocusRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      // O cartão de hover cobriria a estrela durante o avanço da câmera.
      setHovered(null);
      const originPan = engine.openStar(star);
      setReader((current) => openReaderState(current, star.slug, originPan));
    },
    [engine, reader.phase],
  );

  const closeReader = useCallback(() => {
    if (reader.phase === 'closed' || reader.phase === 'closing') return;
    engine.closeReader(reader.originPan);
    setReader(closeReaderState);
  }, [engine, reader]);

  /**
   * O terceiro tempo da abertura: montar o texto.
   *
   * A espera é o avanço da câmera, não um evento de usuário. Fechar antes do
   * fim limpa o timer aqui e `mounted` ainda recusa qualquer fase que não seja
   * `opening` — a vista não remonta sozinha depois de fechada.
   */
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

  // Esc fecha também durante a abertura, quando a vista ainda nem está no DOM.
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

  // Fechado o artigo, o foco volta à estrela de onde ele saiu.
  useEffect(() => {
    if (reader.phase !== 'closed') return;
    const target = returnFocusRef.current;
    returnFocusRef.current = null;
    target?.focus();
  }, [reader.phase]);

  const readerCard = useMemo<ReaderCard | null>(() => {
    if (reader.slug === null || !isMounted(reader)) return null;
    const publication = PUBLICATIONS.find((item) => item.slug === reader.slug);
    if (!publication) return null;

    const date = dateLabel(Date.parse(publication.publishedAt));
    const position = timelinePosition(publication.slug, stars);
    const content = publication.content[locale];

    return {
      category: publication.category,
      categoryLabel: t.categories[publication.category],
      dateLabel: date,
      timelineLabel: position === null ? date : timelineLabel(position, date),
      title: content.title,
      summary: content.summary,
      body: content.body,
    };
  }, [reader, stars, dateLabel, locale, t]);

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
          hover={hoverCard}
          onActivate={onActivate}
          onHover={onHover}
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

        {readerCard && (
          <ReaderView overlayRef={readerRef} card={readerCard} onClose={closeReader} />
        )}
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

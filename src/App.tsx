import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import styles from './App.module.css';
import { Backdrop } from './components/Backdrop/Backdrop';
import { CategoryPanel } from './components/CategoryPanel/CategoryPanel';
import { Cosmos } from './components/Cosmos/Cosmos';
import { CosmosStatus } from './components/CosmosStatus/CosmosStatus';
import type { CosmosStatusKind } from './components/CosmosStatus/CosmosStatus';
import { Header } from './components/Header/Header';
import { Hero } from './components/Hero/Hero';
import { SkipLink } from './components/SkipLink/SkipLink';
import type { HoverCard } from './components/HoverPanel/HoverPanel';
import { ReaderView } from './components/ReaderView/ReaderView';
import type { ReaderCard } from './components/ReaderView/ReaderView';
import { StarIndex } from './components/StarIndex/StarIndex';
import { TimeRuler } from './components/TimeRuler/TimeRuler';
import { countByCategory, dimmedStars } from './core/filter';
import type { SearchableStar } from './core/filter';
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
import type { Category, Viewport } from './core/types';
import { createStaticSource } from './data/PublicationsSource';
import { PUBLICATIONS } from './data/publications';
import { useCosmosEngine } from './hooks/useCosmosEngine';
import { usePrefersReducedMotion } from './hooks/usePrefersReducedMotion';
import { useArticle, usePublications } from './hooks/usePublications';
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
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  /** Quem tinha o foco quando o artigo abriu — para devolvê-lo ao fechar. */
  const returnFocusRef = useRef<HTMLElement | null>(null);

  /**
   * A fonte é criada uma vez: ela ordena o acervo e indexa por slug no
   * construtor, e recriá-la a cada render refaria esse trabalho e disparava o
   * efeito de carregamento em laço.
   */
  const source = useMemo(() => createStaticSource(PUBLICATIONS), []);
  const collection = usePublications(source, locale);
  const summaries = collection.state.items;

  const stars = useMemo(() => placeStars(summaries), [summaries]);

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
      const title = summaries.find((item) => item.slug === star.slug)?.title ?? star.slug;
      return `${title} — ${t.categories[star.category]} — ${dateLabel(star.timestamp)}`;
    },
    [summaries, t, dateLabel],
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

  /**
   * O corpo do artigo vem da fonte, não do acervo já carregado: a lista é
   * enxuta de propósito, e o texto completo será uma segunda chamada quando o
   * backend existir. A busca começa junto com o avanço da câmera, então os
   * 760ms de viagem são folga de sobra para a resposta.
   */
  const article = useArticle(source, reader.slug, locale);

  // Sem texto não há o que montar, e a câmera ficaria avançada sobre uma tela
  // vazia. Não acontece com o adapter estático; acontecerá com o HTTP.
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
    const position = timelinePosition(detail.slug, stars);

    return {
      category: detail.category,
      categoryLabel: t.categories[detail.category],
      dateLabel: date,
      timelineLabel: position === null ? date : timelineLabel(position, date),
      title: detail.title,
      summary: detail.summary,
      body: detail.body,
    };
  }, [reader, article, stars, dateLabel, t]);

  /**
   * A projeção sobre a qual a busca opera.
   *
   * O rótulo da categoria e a data formatada entram aqui porque o handoff manda
   * buscar por eles, e só esta camada os conhece traduzidos — o adapter guarda
   * o slug da categoria e um ISO, que ninguém digita.
   */
  const searchable = useMemo<readonly SearchableStar[]>(
    () =>
      summaries.map((item) => ({
        slug: item.slug,
        category: item.category,
        title: item.title,
        summary: item.summary,
        categoryLabel: t.categories[item.category],
        dateLabel: dateLabel(Date.parse(item.publishedAt)),
      })),
    [summaries, t, dateLabel],
  );

  const dimmed = useMemo(
    () => dimmedStars(searchable, { category, query }),
    [searchable, category, query],
  );
  const counts = useMemo(() => countByCategory(searchable), [searchable]);

  /**
   * A câmera desliza até o primeiro resultado — mas só quando o critério muda.
   *
   * Reagir a `dimmed` sem esta guarda arrastaria a câmera também na chegada dos
   * dados e na troca de idioma, arrancando o leitor de onde ele estava por uma
   * mudança que não foi dele.
   */
  const criteriaKey = `${category}\u0000${query}`;
  const lastCriteriaRef = useRef(criteriaKey);
  const { slideTo } = engine;

  useEffect(() => {
    if (lastCriteriaRef.current === criteriaKey) return;
    lastCriteriaRef.current = criteriaKey;
    const first = stars.find((star) => !dimmed.has(star.slug));
    if (first) slideTo(first);
  }, [criteriaKey, stars, dimmed, slideTo]);

  // Voltar ao início recolhe o painel: reaparecer sozinho na próxima travessia
  // seria um filtro que o leitor não pediu de novo.
  const goHome = useCallback(() => {
    setCategoriesOpen(false);
    engine.goHome();
  }, [engine]);

  /**
   * "Nenhuma estrela" tem causas diferentes e telas diferentes: os dados não
   * chegaram, falharam, ou a busca não achou nada. Ver `src/core/collection.ts`.
   */
  const statusKind = useMemo<CosmosStatusKind | null>(() => {
    if (collection.state.status === 'loading') return 'loading';
    if (collection.state.status === 'error') return 'error';
    if (stars.length === 0 || dimmed.size === stars.length) return 'empty';
    return null;
  }, [collection.state.status, stars.length, dimmed.size]);

  // Esc fecha o painel de categorias. Com o artigo aberto quem responde ao Esc
  // é ele, e o painel está atrás do overlay de qualquer modo.
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
          reducedMotion={reducedMotion}
          hover={hoverCard}
          onActivate={onActivate}
          onHover={onHover}
          onPointerDown={engine.onCosmosPointerDown}
        />

        {statusKind !== null && engine.phase === 'cosmos' && (
          <CosmosStatus kind={statusKind} onRetry={collection.retry} />
        )}

        <Header
          ref={headerRef}
          phase={engine.phase}
          query={query}
          categoriesOpen={categoriesOpen}
          onBrandClick={goHome}
          onQueryChange={setQuery}
          onToggleCategories={() => {
            setCategoriesOpen((open) => !open);
          }}
        />

        <CategoryPanel
          open={categoriesOpen && engine.phase === 'cosmos'}
          counts={counts}
          active={category}
          onPick={setCategory}
        />

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

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
import { articlePath, closeTarget, homePath, parseRoute } from '../../core/routing';
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

/**
 * A experiência inteira: a entrada, a constelação e a vista de leitura.
 *
 * Dona do estado discreto — hover, fase da leitura, filtro, 404 — e da
 * conciliação desse estado com o histórico do navegador. O que muda a cada
 * quadro fica no motor (`useCosmosEngine`), fora do React.
 */
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

  /** Quem tinha o foco quando o artigo abriu — para devolvê-lo ao fechar. */
  const returnFocusRef = useRef<HTMLElement | null>(null);

  /**
   * Se a entrada de histórico do artigo aberto é nossa.
   *
   * Só é quando foi um clique numa estrela que a empilhou. Numa chegada direta
   * pela URL a entrada é de quem veio antes — de outro site, ou de nenhum — e
   * fechar não pode voltar para lá. Ver `closeTarget`.
   */
  const ownsEntryRef = useRef(false);

  /** O slug que a URL trouxe na carga, à espera de o acervo chegar. */
  const pendingSlugRef = useRef(route.kind === 'article' ? route.slug : null);

  /**
   * A fonte é criada uma vez: ela ordena o acervo e indexa por slug no
   * construtor, e recriá-la a cada render refaria esse trabalho e disparava o
   * efeito de carregamento em laço.
   */
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

  /**
   * O lado do cartão é decidido uma vez, quando o ponteiro chega.
   *
   * O pan vive fora do React e muda a cada quadro; reavaliar o lado a cada um
   * deles custaria um segundo laço para reposicionar um cartão que, na prática,
   * some assim que a constelação se move sob o ponteiro.
   */
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

  /**
   * O Tab percorre o acervo inteiro, e quase todo ele está fora da tela.
   *
   * Sem levar a câmera junto, o anel de foco ficava do lado de fora. A guarda
   * do `needsSlide` é o que impede o efeito contrário: arrastar a constelação a
   * cada passo entre duas estrelas vizinhas, e desfazer o recuo que o
   * fechamento da vista de leitura acabou de prometer devolver.
   */
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
      // A URL passa a ser a do artigo, e o voltar do navegador fecha a vista —
      // é a mesma entrada de histórico que o "×" desfaz.
      window.history.pushState(null, '', articlePath(locale, star.slug));
      ownsEntryRef.current = true;
      setNotFound(false);
    },
    [engine, reader.phase, locale],
  );

  /**
   * Fecha a vista sem tocar no histórico.
   *
   * É o que o `popstate` chama: ali a URL já mudou, e empurrar outra entrada em
   * resposta faria o botão de voltar precisar de dois toques para sair.
   */
  const applyClose = useCallback(() => {
    if (reader.phase === 'closed' || reader.phase === 'closing') return;
    engine.closeReader(reader.originPan);
    setReader(closeReaderState);
  }, [engine, reader]);

  /**
   * Fechar por gesto: o "×", o botão do fim do artigo, Esc.
   *
   * A vista fecha aqui e agora, antes de mexer no histórico. Delegar o
   * fechamento ao `popstate` que o `back()` dispara amarraria a interface a um
   * evento que chega num próximo quadro — e que não chega de jeito nenhum se a
   * entrada anterior for a mesma URL.
   */
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
   * A chegada direta: `/pt/publicacoes/{slug}` aberto do zero.
   *
   * Só dá para fazer isto depois de o acervo chegar — antes dele não há
   * estrela para enquadrar nem como saber se o slug existe. Daí a espera pelo
   * `ready`: é ele que separa "ainda não carregou" de "não existe", e é a
   * diferença entre a tela de espera e o 404.
   */
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

  // Um endereço que não é rota nenhuma também começa do outro lado do portal:
  // o 404 é uma tela da constelação, não do hero.
  useEffect(() => {
    if (route.kind !== 'notfound') return;
    jumpTo(null);
  }, [route.kind, jumpTo]);

  /**
   * Voltar e avançar do navegador.
   *
   * A URL já é a verdade quando este evento chega; o trabalho aqui é só
   * reconciliar a vista com ela. Avançar de volta para um artigo o reabre sem a
   * viagem de câmera — repeti-la seria encenar uma origem que, nesse caminho,
   * não existe.
   */
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
      // Há entrada anterior: foi de lá que este passo do histórico veio.
      ownsEntryRef.current = true;
      jumpTo(star);
      setReader((current) => landed(current, next.slug));
    };

    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }, [stars, jumpTo, applyClose]);

  /**
   * Trocar de idioma traduz a URL no lugar.
   *
   * É a mesma publicação nos dois idiomas — é o que o par de `hreflang` diz — e
   * portanto não é uma navegação: empilhar entrada aqui encheria o histórico de
   * voltas que só alternam a língua da mesma página.
   */
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

  usePageHead(reader, article, locale, t);

  // Voltar ao início recolhe o painel: reaparecer sozinho na próxima travessia
  // seria um filtro que o leitor não pediu de novo.
  const goHome = useCallback(() => {
    setCategoriesOpen(false);
    setNotFound(false);
    window.history.replaceState(null, '', homePath(locale));
    engine.goHome();
  }, [engine, locale]);

  /**
   * "Nenhuma estrela" tem causas diferentes e telas diferentes: os dados não
   * chegaram, falharam, a busca não achou nada, ou o endereço não existe. Ver
   * `src/core/collection.ts`.
   *
   * O 404 vem primeiro porque não é sobre o acervo: com um endereço inválido, a
   * constelação atrás pode estar perfeitamente cheia, e dizer "nenhuma estrela
   * encontrada" mandaria a pessoa ajustar uma busca que ela não fez.
   */
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
          <Hero ref={heroBlockRef} onEnter={engine.goCosmos} active={engine.phase === 'hero'} />
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

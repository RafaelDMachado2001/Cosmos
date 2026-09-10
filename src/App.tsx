import { useCallback, useRef } from 'react';

import styles from './App.module.css';
import { Backdrop } from './components/Backdrop/Backdrop';
import { Header } from './components/Header/Header';
import { Hero } from './components/Hero/Hero';
import { SkipLink } from './components/SkipLink/SkipLink';
import { usePrefersReducedMotion } from './hooks/usePrefersReducedMotion';
import { LocaleProvider } from './i18n/LocaleProvider';

/**
 * Casca da experiência.
 *
 * A fase 2 entrega a tela de entrada: núcleo, vinheta, header reduzido e o
 * bloco de texto. A travessia do portal e a constelação entram na fase 3 —
 * `enter` ainda é fixo em 0.
 */
function Shell() {
  const reducedMotion = usePrefersReducedMotion();

  const rootRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const heroBlockRef = useRef<HTMLDivElement>(null);

  const onEnter = useCallback(() => {
    // Fase 3: completa a travessia. Por ora o botão não tem para onde levar.
  }, []);

  return (
    <>
      <SkipLink />
      <div ref={rootRef} className={styles.stage}>
        <Backdrop
          rootRef={rootRef}
          headerRef={headerRef}
          textBlockRef={heroBlockRef}
          reducedMotion={reducedMotion}
        />
        <div className={styles.vignette} aria-hidden="true" />

        <Header ref={headerRef} phase="hero" onBrandClick={onEnter} />

        <main id="conteudo" className={styles.content} tabIndex={-1}>
          <Hero ref={heroBlockRef} onEnter={onEnter} />
        </main>
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

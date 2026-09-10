import styles from './App.module.css';
import { SkipLink } from './components/SkipLink/SkipLink';
import { LocaleProvider } from './i18n/LocaleProvider';
import { useLocale } from './i18n/useLocale';

/**
 * Casca da experiência. As camadas (canvas, hero, cosmos, leitor) entram nas
 * fases seguintes; a ordem de empilhamento já está reservada em tokens.css.
 */
function Shell() {
  const { t } = useLocale();

  return (
    <>
      <SkipLink />
      <div className={styles.stage}>
        <div className={styles.vignette} aria-hidden="true" />
        <main id="conteudo" className={styles.content} tabIndex={-1}>
          <p className={styles.kicker}>{t.hero.kicker}</p>
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

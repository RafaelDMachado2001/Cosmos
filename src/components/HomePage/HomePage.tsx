import styles from './HomePage.module.css';
import { useLocale } from '../../i18n/useLocale';
import { ArticleIndex } from '../ArticleIndex/ArticleIndex';
import type { ArticleLink } from '../ArticleIndex/ArticleIndex';

export interface HomePageProps {
  readonly otherLocaleHref: string;
  readonly index: readonly ArticleLink[];
  /**
   * Presente só na página de 404, que é esta mesma com um aviso no lugar do
   * hero. Quem chegou a um endereço que não existe precisa de duas coisas: que
   * lhe digam isso, e uma lista de onde ir — e a lista já está aqui.
   */
  readonly notice?: { readonly title: string; readonly subtitle: string };
}

/**
 * A constelação em forma de lista, para quem não pode vê-la.
 *
 * Sem esta página a navegação sem JavaScript não teria por onde começar: os
 * artigos existem pré-renderizados, mas nada apontaria para eles. O `StarIndex`
 * cumpre esse papel no cliente; aqui ele precisa existir antes de o React montar.
 *
 * Não tenta imitar o cosmos. Quem chega aqui já não vai vê-lo, e um esqueleto
 * decorativo sem o motor por trás seria ruído entre a pessoa e os textos.
 */
export function HomePage({ otherLocaleHref, index, notice }: HomePageProps) {
  const { t } = useLocale();

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <span className={styles.brand}>{t.nav.brand}</span>
        <a
          className={styles.other}
          href={otherLocaleHref}
          hrefLang={t.nav.otherLocaleTag}
          // `hrefLang` descreve o destino; `lang` descreve este texto, que está
          // escrito na outra língua. Sem ele o leitor de tela pronuncia
          // "PORTUGUÊS" com a fonética do idioma da página.
          lang={t.nav.otherLocaleTag}
        >
          {t.nav.otherLocale}
        </a>
      </header>

      <main className={styles.main}>
        <p className={styles.kicker}>{t.hero.kicker}</p>
        <h1 className={styles.title}>{notice?.title ?? t.hero.title}</h1>
        <p className={styles.subtitle}>{notice?.subtitle ?? t.hero.subtitle}</p>

        <ArticleIndex items={index} />
      </main>
    </div>
  );
}

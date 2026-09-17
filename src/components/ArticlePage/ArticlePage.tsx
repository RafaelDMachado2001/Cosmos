import styles from './ArticlePage.module.css';
import { useLocale } from '../../i18n/useLocale';

export interface ArticleLink {
  readonly href: string;
  readonly title: string;
}

export interface ArticlePageProps {
  readonly categoryLabel: string;
  readonly dateLabel: string;
  readonly title: string;
  readonly summary: string;
  readonly body: readonly string[];
  readonly homeHref: string;
  /** O mesmo artigo no outro idioma — o par que o `hreflang` anuncia. */
  readonly otherLocaleHref: string;
  /** O acervo inteiro, para que daqui se alcance qualquer outra publicação. */
  readonly index: readonly ArticleLink[];
}

/**
 * O artigo como documento, sem constelação e sem WebGL.
 *
 * É esta árvore que o prerender grava em `/{locale}/{segmento}/{slug}/index.html`
 * no build, e é ela que um rastreador ou alguém sem JavaScript recebe. O handoff
 * é direto: "a camada 3D não pode esconder o conteúdo dos buscadores" e "a
 * navegação sem JavaScript deve levar a essas páginas".
 *
 * Deliberadamente fora da `Shell`: renderizá-la no servidor arrastaria a cena
 * Three, o `requestAnimationFrame` e as leituras de `getComputedStyle` para
 * dentro do Node. Aqui não há nada que precise de um navegador.
 *
 * No cliente esta casca é descartada assim que o React monta — ver `main.tsx`.
 */
export function ArticlePage({
  categoryLabel,
  dateLabel,
  title,
  summary,
  body,
  homeHref,
  otherLocaleHref,
  index,
}: ArticlePageProps) {
  const { t } = useLocale();

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <a className={styles.brand} href={homeHref}>
          {t.nav.brand}
        </a>
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

      <article className={styles.article}>
        <p className={styles.meta}>
          {categoryLabel}
          <span className={styles.metaDate}>/ {dateLabel}</span>
        </p>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.lede}>{summary}</p>
        <div className={styles.filet} aria-hidden="true" />

        {body.map((paragraph, position) => (
          <p key={position} className={styles.paragraph}>
            {paragraph}
          </p>
        ))}

        <footer className={styles.footer}>
          <a className={styles.back} href={homeHref}>
            {t.reader.back}
          </a>
        </footer>
      </article>

      {/*
        O acervo inteiro, como no `StarIndex`: sem ele cada artigo seria uma
        folha solta, alcançável só por quem já sabe a URL.
      */}
      <nav className={styles.index} aria-label={t.star.indexLabel}>
        <h2 className={styles.indexTitle}>{t.star.indexLabel}</h2>
        <ul>
          {index.map((item) => (
            <li key={item.href}>
              <a href={item.href}>{item.title}</a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

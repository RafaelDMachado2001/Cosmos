import styles from './ArticlePage.module.css';
import { ArticleBody } from '../ArticleBody/ArticleBody';
import { categoryThemeStyle } from '../CategoryTheme/themeStyle';
import { parseBlocks } from '../../core/blocks';
import { readingMinutes } from '../../core/readingTime';
import type { Category } from '../../core/types';
import { useLocale } from '../../i18n/useLocale';

export interface ArticleLink {
  readonly href: string;
  readonly title: string;
}

export interface ArticlePageProps {
  readonly category: Category;
  readonly categoryLabel: string;
  readonly dateLabel: string;
  readonly title: string;
  readonly summary: string;
  /** Markdown cru — ver `PublicationContent.body` em `core/types.ts`. */
  readonly body: string;
  readonly homeHref: string;
  /**
   * O mesmo artigo no outro idioma — o par que o `hreflang` anuncia.
   *
   * Nulo quando a publicação existe só neste idioma: o formulário do painel
   * permite, e sem essa tradução não há página para onde apontar.
   */
  readonly otherLocaleHref: string | null;
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
  category,
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
  const minutes = readingMinutes(parseBlocks(body));

  return (
    <div className={styles.page} style={categoryThemeStyle(category)}>
      <header className={styles.top}>
        <a className={styles.brand} href={homeHref}>
          {t.nav.brand}
        </a>
        {otherLocaleHref !== null && (
          <a
            className={styles.other}
            href={otherLocaleHref}
            hrefLang={t.nav.otherLocaleTag}
            // `hrefLang` descreve o destino; `lang` descreve este texto, que
            // está escrito na outra língua. Sem ele o leitor de tela
            // pronuncia "PORTUGUÊS" com a fonética do idioma da página.
            lang={t.nav.otherLocaleTag}
          >
            {t.nav.otherLocale}
          </a>
        )}
      </header>

      <article className={styles.article}>
        <p className={styles.meta}>
          {categoryLabel}
          <span className={styles.metaDate}>
            / {dateLabel} · {minutes} {t.reader.minutes}
          </span>
        </p>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.lede}>{summary}</p>
        <div className={styles.filet} aria-hidden="true" />

        <ArticleBody markdown={body} />

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

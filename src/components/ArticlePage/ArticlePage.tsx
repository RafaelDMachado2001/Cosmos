import styles from './ArticlePage.module.css';
import { ArticleBody } from '../ArticleBody/ArticleBody';
import { ArticleIndex } from '../ArticleIndex/ArticleIndex';
import type { ArticleLink } from '../ArticleIndex/ArticleIndex';
import { ArticleTags } from '../ArticleTags/ArticleTags';
import { BrandMark } from '../BrandMark/BrandMark';
import { categoryThemeStyle } from '../CategoryTheme/themeStyle';
import { SiteFooter } from '../SiteFooter/SiteFooter';
import { parseBlocks } from '../../core/blocks';
import { readingMinutes } from '../../core/readingTime';
import type { Category } from '../../core/types';
import { useLocale } from '../../i18n/useLocale';

export interface ArticlePageProps {
  readonly category: Category;
  readonly categoryLabel: string;
  readonly dateLabel: string;
  readonly publishedAt: string;
  readonly title: string;
  readonly summary: string;
  readonly body: string;
  readonly tags: readonly string[];
  readonly homeHref: string;
  readonly otherLocaleHref: string | null;
  readonly index: readonly ArticleLink[];
}

export function ArticlePage({
  category,
  categoryLabel,
  dateLabel,
  publishedAt,
  title,
  summary,
  body,
  tags,
  homeHref,
  otherLocaleHref,
  index,
}: ArticlePageProps) {
  const { t } = useLocale();
  const minutes = readingMinutes(parseBlocks(body));

  return (
    <div className={styles.page} style={categoryThemeStyle(category)} data-category={category}>
      <header className={styles.top}>
        <a className={styles.brand} href={homeHref}>
          <BrandMark product="cosmos" className={styles.mark} />
          {t.nav.brand}
        </a>
        {otherLocaleHref !== null && (
          <a
            className={styles.other}
            href={otherLocaleHref}
            hrefLang={t.nav.otherLocaleTag}
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
            / <time dateTime={publishedAt}>{dateLabel}</time> · {minutes} {t.reader.minutes}
          </span>
        </p>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.lede}>{summary}</p>
        <ArticleTags tags={tags} className={styles.tags} />
        <div className={styles.filet} aria-hidden="true" />

        <ArticleBody markdown={body} />

        <footer className={styles.footer}>
          <a className={styles.back} href={homeHref}>
            {t.reader.back}
          </a>
        </footer>
      </article>

      <ArticleIndex items={index} className={styles.index} />
      <SiteFooter className={styles.siteFooter} />
    </div>
  );
}

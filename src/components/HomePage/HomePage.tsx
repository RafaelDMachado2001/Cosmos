import styles from './HomePage.module.css';
import { useLocale } from '../../i18n/useLocale';
import { ArticleIndex } from '../ArticleIndex/ArticleIndex';
import type { ArticleLink } from '../ArticleIndex/ArticleIndex';
import { BrandMark } from '../BrandMark/BrandMark';

export interface HomePageProps {
  readonly otherLocaleHref: string;
  readonly index: readonly ArticleLink[];
  readonly notice?: { readonly title: string; readonly subtitle: string };
}

export function HomePage({ otherLocaleHref, index, notice }: HomePageProps) {
  const { t } = useLocale();

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <span className={styles.brand}>
          <BrandMark product="cosmos" className={styles.mark} />
          {t.nav.brand}
        </span>
        <a
          className={styles.other}
          href={otherLocaleHref}
          hrefLang={t.nav.otherLocaleTag}
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

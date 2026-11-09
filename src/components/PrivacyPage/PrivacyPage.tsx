import styles from './PrivacyPage.module.css';
import { dayLabel, fill } from '../../core/format';
import { privacyPath } from '../../core/routing';
import { useStaticPage } from '../../hooks/useStaticPage';
import { PRIVACY, PRIVACY_UPDATED } from '../../i18n/privacy';
import { useLocale } from '../../i18n/useLocale';
import { PageFrame } from '../PageFrame/PageFrame';

export interface PrivacyPageProps {
  readonly otherLocaleHref?: string;
}

export function PrivacyPage({ otherLocaleHref }: PrivacyPageProps) {
  const { locale, t } = useLocale();
  const sections = PRIVACY[locale];
  useStaticPage(privacyPath, t.privacy.title);

  return (
    <PageFrame
      width="measure"
      current="privacy"
      {...(otherLocaleHref === undefined ? {} : { otherLocaleHref })}
    >
      <article className={styles.article}>
        <p className={styles.kicker}>{t.privacy.kicker}</p>
        <h1 className={styles.title}>{t.privacy.title}</h1>
        <p className={styles.updated}>
          <time dateTime={PRIVACY_UPDATED}>
            {fill(t.privacy.updated, { date: dayLabel(PRIVACY_UPDATED, locale) })}
          </time>
        </p>
        <nav className={styles.toc} aria-labelledby="privacidade-sumario">
          <p id="privacidade-sumario" className={styles.tocTitle}>
            {t.privacy.inThisPage}
          </p>
          <ul className={styles.tocList}>
            {sections.map((section) => (
              <li key={section.id}>
                <a className={styles.tocLink} href={`#${section.id}`}>
                  <span aria-hidden="true">– </span>
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        {sections.map((section) => (
          <section key={section.id} className={styles.section} aria-labelledby={section.id}>
            <span className={styles.filet} aria-hidden="true" />
            <h2 id={section.id} className={styles.heading}>
              {section.title}
            </h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph} className={styles.paragraph}>
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </article>
    </PageFrame>
  );
}

import { forwardRef } from 'react';

import styles from './Hero.module.css';
import { useLocale } from '../../i18n/useLocale';

export interface HeroProps {
  readonly onEnter: () => void;
  readonly onSkip: () => void;
  readonly active: boolean;
  readonly heading: boolean;
}

export const Hero = forwardRef<HTMLDivElement, HeroProps>(function Hero({ onEnter, onSkip, active, heading }, ref) {
  const { t } = useLocale();

  return (
    <div ref={ref} className={styles.block} {...(active ? {} : { inert: '' })}>
      <p className={styles.kicker}>{t.hero.kicker}</p>
      {heading ? (
        <h1 className={styles.title}>{t.hero.title}</h1>
      ) : (
        <p className={styles.title}>{t.hero.title}</p>
      )}
      <p className={styles.subtitle}>{t.hero.subtitle}</p>

      <button type="button" className={styles.skip} onClick={onSkip}>
        {t.hero.skip}
        <span aria-hidden="true"> →</span>
      </button>

      <button
        type="button"
        className={styles.enter}
        onClick={onEnter}
        aria-label={t.hero.scrollHint}
      >
        <svg className={styles.mouse} viewBox="0 0 24 38" aria-hidden="true" focusable="false">
          <rect
            x="1"
            y="1"
            width="22"
            height="36"
            rx="11"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <circle className={styles.wheel} cx="12" cy="10" r="2" fill="currentColor" />
        </svg>
      </button>
    </div>
  );
});

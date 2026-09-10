import { forwardRef } from 'react';

import styles from './Hero.module.css';
import { useLocale } from '../../i18n/useLocale';

export interface HeroProps {
  /** Equivale a completar o scroll de entrada. */
  readonly onEnter: () => void;
}

/**
 * Bloco de texto do hero, ancorado à base.
 *
 * A ref aponta para o bloco de texto, não para o container: é a posição real
 * dele que define a faixa livre onde o núcleo é enquadrado.
 */
export const Hero = forwardRef<HTMLDivElement, HeroProps>(function Hero({ onEnter }, ref) {
  const { t } = useLocale();

  return (
    <div ref={ref} className={styles.block}>
      <p className={styles.kicker}>{t.hero.kicker}</p>
      <h1 className={styles.title}>{t.hero.title}</h1>
      <p className={styles.subtitle}>{t.hero.subtitle}</p>

      <button type="button" className={styles.enter} onClick={onEnter}>
        {t.hero.scrollHint}
        <span className={styles.dash} aria-hidden="true" />
      </button>
    </div>
  );
});

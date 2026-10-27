import { forwardRef } from 'react';

import styles from './Hero.module.css';
import { useLocale } from '../../i18n/useLocale';

export interface HeroProps {
  /** Equivale a completar o scroll de entrada. */
  readonly onEnter: () => void;
  /** Vai direto à constelação, sem a travessia da esfera. */
  readonly onSkip: () => void;
  /**
   * Fora do hero o bloco só some na tela: o motor o apaga e o amplia para
   * baixo da borda, mas o botão continuava na ordem de Tab. Focá-lo rolava o
   * palco e puxava o cabeçalho para cima.
   */
  readonly active: boolean;
  /**
   * Se o título do hero é o `<h1>` da página. Com um artigo aberto o `<h1>` é o
   * título dele, e o do hero vira parágrafo: dois H1 diziam a um buscador que a
   * página tinha dois assuntos principais.
   */
  readonly heading: boolean;
}

/**
 * Bloco de texto do hero, ancorado à base.
 *
 * A ref aponta para o bloco de texto, não para o container: é a posição real
 * dele que define a faixa livre onde o núcleo é enquadrado.
 */
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

      {/*
       * Quem não sabe que a tela rola, ou não quer esperar a esfera, tinha
       * só o ícone do mouse. Este é o caminho escrito, e sem animação.
       */}
      <button type="button" className={styles.skip} onClick={onSkip}>
        {t.hero.skip}
        <span aria-hidden="true"> →</span>
      </button>

      {/*
       * O ícone é decorativo; quem nomeia o botão é o aria-label. Sem texto
       * visível, `scrollHint` deixa de ser rótulo na tela e passa a existir só
       * para leitor de tela — por isso está em caixa de sentença no i18n.
       */}
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

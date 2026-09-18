import { forwardRef } from 'react';
import type { RefObject } from 'react';

import styles from './TimeRuler.module.css';
import { useLocale } from '../../i18n/useLocale';

export interface TimeRulerProps {
  readonly railRef: RefObject<HTMLDivElement>;
  readonly markerRef: RefObject<HTMLSpanElement>;
  readonly onPointerDown: (event: React.PointerEvent) => void;
}

/** Régua temporal do rodapé: passado à esquerda, presente à direita. */
export const TimeRuler = forwardRef<HTMLDivElement, TimeRulerProps>(function TimeRuler(
  { railRef, markerRef, onPointerDown },
  ref,
) {
  const { t } = useLocale();

  return (
    <div ref={ref} className={styles.scrub}>
      <span className={styles.edge}>{t.ruler.past}</span>

      <div
        ref={railRef}
        className={styles.rail}
        role="slider"
        tabIndex={0}
        aria-label={t.ruler.label}
        aria-valuemin={0}
        aria-valuemax={100}
        /*
         * `aria-valuenow` e `aria-valuetext` são escritos pelo laço de quadro,
         * pelo `railRef` — o pan muda a cada quadro e não passa pelo React. Um
         * `slider` sem `valuenow` é ARIA inválida, e a porcentagem sozinha não
         * diz nada sobre um acervo temporal: o `valuetext` anuncia o ano, que é
         * o que os marcadores mostram a quem vê.
         */
        aria-valuenow={0}
        onPointerDown={onPointerDown}
      >
        <span className={styles.track} aria-hidden="true" />
        <span ref={markerRef} className={styles.marker} aria-hidden="true" />
      </div>

      <span className={styles.edge}>{t.ruler.now}</span>
      <span className={styles.hint}>{t.ruler.dragHint}</span>
    </div>
  );
});

import { useMemo } from 'react';

import styles from './Nebula.module.css';
import { blobOpacity, nebulaLayout } from '../../core/nebula';
import type { NebulaVariant } from '../../core/nebula';

export interface NebulaProps {
  /** A mesma semente abre sempre o mesmo céu — o slug, na leitura. */
  readonly seed: string;
  readonly variant: NebulaVariant;
  /** 0 a 1.6; ver `core/appearance.ts`. */
  readonly intensity: number;
  readonly motion: boolean;
  readonly className?: string;
}

const pct = (value: number): string => `${value.toFixed(2)}%`;

/**
 * A nebulosa da tela de leitura, em HTML: manchas com `radial-gradient` nas
 * cores do tema, poeira escura por cima e estrelas. Sempre atrás do texto e
 * nunca alvo de ponteiro. O movimento só liga com `motion` e quando o
 * sistema não pede movimento reduzido (o CSS decide a segunda parte).
 */
export function Nebula({ seed, variant, intensity, motion, className }: NebulaProps) {
  const layout = useMemo(() => nebulaLayout(seed, variant), [seed, variant]);

  return (
    <div
      className={[styles.nebula, motion ? styles.moving : '', className ?? ''].join(' ')}
      aria-hidden="true"
      data-variant={variant}
    >
      {layout.blobs.map((blob, index) => (
        <span
          key={`b${String(index)}`}
          className={styles.blob}
          style={{
              left: pct(blob.x),
              top: pct(blob.y),
              width: pct(blob.width),
              height: pct(blob.height),
              opacity: blobOpacity(blob.base, intensity),
              filter: `blur(${String(Math.round(blob.blurPx))}px)`,
              background: `radial-gradient(closest-side, var(--${blob.tone}), transparent)`,
              animationDuration: `${blob.driftSec.toFixed(1)}s`,
              animationDelay: `${blob.delaySec.toFixed(1)}s`,
          }}
        />
      ))}
      {layout.dust.map((lane, index) => (
        <span
          key={`d${String(index)}`}
          className={styles.dust}
          style={{
            left: pct(lane.x),
            top: pct(lane.y),
            width: pct(lane.width),
            height: pct(lane.height),
            transform: `rotate(${lane.angleDeg.toFixed(1)}deg)`,
          }}
        />
      ))}
      {layout.stars.map((star, index) => (
        <span
          key={`s${String(index)}`}
          className={star.sparkle ? styles.sparkle : star.twinkle ? styles.twinkle : styles.star}
          style={{
            left: pct(star.x),
            top: pct(star.y),
            width: `${String(star.sizePx)}px`,
            height: `${String(star.sizePx)}px`,
            animationDelay: `${star.delaySec.toFixed(1)}s`,
          }}
        />
      ))}
    </div>
  );
}

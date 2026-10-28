import styles from './BrandMark.module.css';

export type BrandProduct = 'cosmos' | 'studio';

/**
 * A marca dos produtos RDM: um anel, o núcleo e uma lua na cor do produto.
 * A lua no alto é o Cosmos; embaixo, o Studio.
 *
 * O traçado é o do favicon (32 unidades), não o do logo grande: nos tamanhos
 * em que a interface usa a marca, o anel fino do logo de 100 sumiria.
 * Decorativa — quem a usa sempre traz o nome escrito ao lado.
 */
export function BrandMark({
  product,
  className,
}: {
  readonly product: BrandProduct;
  readonly className?: string | undefined;
}): React.JSX.Element {
  return (
    <svg
      className={[styles.mark, className].filter(Boolean).join(' ')}
      data-product={product}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <circle className={styles.ring} cx="16" cy="16" r="11" />
      <circle className={styles.core} cx="16" cy="16" r="5" />
      <circle className={styles.moon} cx="16" cy={product === 'cosmos' ? 5 : 27} r="4" />
    </svg>
  );
}

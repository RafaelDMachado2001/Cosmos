import styles from './BrandMark.module.css';

export type BrandProduct = 'cosmos' | 'studio';

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

import styles from './SearchField.module.css';
import { useLocale } from '../../i18n/useLocale';

export interface SearchFieldProps {
  readonly visible: boolean;
  readonly value: string;
  readonly onChange: (value: string) => void;
}

/**
 * A busca do header.
 *
 * Um `input` comum, controlado: o texto é estado discreto — muda por tecla, não
 * por quadro — e o que ele produz é um conjunto de slugs apagados, não um
 * remonte da constelação.
 *
 * Existe desde o hero, invisível e fora do Tab, pelo mesmo motivo da navegação:
 * montá-lo na travessia daria um salto de layout no header.
 */
export function SearchField({ visible, value, onChange }: SearchFieldProps) {
  const { t } = useLocale();

  return (
    <label
      className={styles.field}
      data-visible={visible}
      aria-hidden={!visible}
      {...(visible ? {} : { inert: '' })}
    >
      <span className={styles.icon} aria-hidden="true" />
      <span className="visually-hidden">{t.search.label}</span>
      <input
        className={styles.input}
        type="search"
        value={value}
        placeholder={t.search.placeholder}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
    </label>
  );
}

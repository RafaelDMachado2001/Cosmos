import type { TableAlign } from '../core/blocks';
import type { DraftBlock } from '../core/draftBlocks';
import styles from './BlockEditor.module.css';

type TableBlock = Extract<DraftBlock, { type: 'table' }>;

const ALIGN_CYCLE: readonly TableAlign[] = [null, 'left', 'center', 'right'];
const ALIGN_LABEL: Record<NonNullable<TableAlign> | 'none', string> = {
  none: '·',
  left: '⇤',
  center: '↔',
  right: '⇥',
};
const ALIGN_NAME: Record<NonNullable<TableAlign> | 'none', string> = {
  none: 'padrão',
  left: 'à esquerda',
  center: 'centralizado',
  right: 'à direita',
};

/**
 * Uma tabela de Markdown, editada como grade. Toda linha tem sempre uma
 * célula por coluna — é o que a validação exige e o que impede o
 * serializador de completar ou cortar texto em silêncio.
 */
export function TableFields({
  block,
  onChange,
}: {
  readonly block: TableBlock;
  readonly onChange: (block: DraftBlock) => void;
}): React.JSX.Element {
  const columns = block.align.length;

  function setCell(row: number, column: number, value: string): void {
    if (row === -1) {
      onChange({ ...block, header: block.header.map((cell, i) => (i === column ? value : cell)) });
      return;
    }
    onChange({
      ...block,
      rows: block.rows.map((cells, r) => (r === row ? cells.map((cell, i) => (i === column ? value : cell)) : cells)),
    });
  }

  function addColumn(): void {
    onChange({
      ...block,
      align: [...block.align, null],
      header: [...block.header, ''],
      rows: block.rows.map((cells) => [...cells, '']),
    });
  }

  function removeColumn(column: number): void {
    if (columns <= 1) return;
    const drop = <T,>(cells: readonly T[]): T[] => cells.filter((_, i) => i !== column);
    onChange({ ...block, align: drop(block.align), header: drop(block.header), rows: block.rows.map(drop) });
  }

  function cycleAlign(column: number): void {
    const current = ALIGN_CYCLE.indexOf(block.align[column] ?? null);
    const next = ALIGN_CYCLE[(current + 1) % ALIGN_CYCLE.length] ?? null;
    onChange({ ...block, align: block.align.map((align, i) => (i === column ? next : align)) });
  }

  function addRow(): void {
    onChange({ ...block, rows: [...block.rows, block.align.map(() => '')] });
  }

  function removeRow(row: number): void {
    onChange({ ...block, rows: block.rows.filter((_, r) => r !== row) });
  }

  function cell(row: number, column: number, value: string): React.JSX.Element {
    const label = row === -1 ? `Cabeçalho, coluna ${String(column + 1)}` : `Linha ${String(row + 1)}, coluna ${String(column + 1)}`;
    return (
      <input
        type="text"
        className={row === -1 ? styles.tableHeaderInput : styles.tableInput}
        aria-label={label}
        value={value}
        onChange={(event) => setCell(row, column, event.target.value)}
      />
    );
  }

  return (
    <div className={styles.fieldGroup}>
      <div className={styles.tableGrid} style={{ gridTemplateColumns: `repeat(${String(columns)}, minmax(110px, 1fr)) 28px` }}>
        {block.align.map((align, column) => (
          <div key={`tools-${String(column)}`} className={styles.tableColumnTools}>
            <button
              type="button"
              onClick={() => cycleAlign(column)}
              aria-label={`Alinhamento da coluna ${String(column + 1)}: ${ALIGN_NAME[align ?? 'none']}`}
              title={`Alinhamento: ${ALIGN_NAME[align ?? 'none']}`}
            >
              {ALIGN_LABEL[align ?? 'none']}
            </button>
            <button
              type="button"
              onClick={() => removeColumn(column)}
              disabled={columns <= 1}
              aria-label={`Remover coluna ${String(column + 1)}`}
            >
              ✕
            </button>
          </div>
        ))}
        <span />

        {block.header.map((value, column) => (
          <div key={`h-${String(column)}`}>{cell(-1, column, value)}</div>
        ))}
        <span />

        {block.rows.map((cells, row) => [
          ...cells.map((value, column) => <div key={`${String(row)}-${String(column)}`}>{cell(row, column, value)}</div>),
          <button
            key={`remove-${String(row)}`}
            type="button"
            className={styles.tableRowRemove}
            onClick={() => removeRow(row)}
            aria-label={`Remover linha ${String(row + 1)}`}
          >
            ✕
          </button>,
        ])}
      </div>
      <div className={styles.tableActions}>
        <button type="button" className={styles.addButton} onClick={addRow}>
          + linha
        </button>
        <button type="button" className={styles.addButton} onClick={addColumn}>
          + coluna
        </button>
      </div>
    </div>
  );
}

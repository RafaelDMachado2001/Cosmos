import { useState } from 'react';

import { validateDraftBlock } from '../core/draftValidation';
import type { DraftBlock } from '../core/draftBlocks';
import styles from './BlockEditor.module.css';
import { api } from './api';

export interface BlockEditorProps {
  readonly blocks: readonly DraftBlock[];
  readonly onChange: (blocks: readonly DraftBlock[]) => void;
}

/**
 * `getRandomValues`, não `randomUUID`: este só existe em contexto seguro
 * (HTTPS ou localhost), e o painel aberto por HTTP em qualquer outro host
 * lançava no clique — nenhum bloco podia ser adicionado.
 */
function newId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return `b${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

function blankBlock(type: DraftBlock['type']): DraftBlock {
  switch (type) {
    case 'p':
    case 'h2':
    case 'h3':
    case 'quote':
      return { id: newId(), type, text: '' };
    case 'code':
      return { id: newId(), type, lang: null, text: '' };
    case 'list':
      return { id: newId(), type, ordered: false, items: [''] };
    case 'img':
      return { id: newId(), type, url: '', mediaId: null, alt: '', caption: null };
  }
}

const TYPE_LABEL: Record<DraftBlock['type'], string> = {
  p: 'Parágrafo',
  h2: 'Intertítulo',
  h3: 'Subtítulo',
  quote: 'Citação',
  list: 'Lista',
  code: 'Código',
  img: 'Imagem',
};

function replace(blocks: readonly DraftBlock[], index: number, block: DraftBlock): readonly DraftBlock[] {
  return blocks.map((current, i) => (i === index ? block : current));
}

export function BlockEditor({ blocks, onChange }: BlockEditorProps): React.JSX.Element {
  function update(index: number, block: DraftBlock): void {
    onChange(replace(blocks, index, block));
  }

  function remove(index: number): void {
    onChange(blocks.filter((_, i) => i !== index));
  }

  function move(index: number, delta: number): void {
    const target = index + delta;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    const [moved] = next.splice(index, 1);
    if (moved === undefined) return;
    next.splice(target, 0, moved);
    onChange(next);
  }

  function add(type: DraftBlock['type']): void {
    onChange([...blocks, blankBlock(type)]);
  }

  return (
    <div className={styles.editor}>
      {blocks.map((block, index) => {
        const error = validateDraftBlock(block);
        return (
          <div key={block.id} className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardType}>{TYPE_LABEL[block.type]}</span>
              <div className={styles.cardActions}>
                <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Mover para cima">
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === blocks.length - 1}
                  aria-label="Mover para baixo"
                >
                  ↓
                </button>
                <button type="button" onClick={() => remove(index)} aria-label="Remover bloco">
                  ✕
                </button>
              </div>
            </div>

            <BlockFields block={block} onChange={(next) => update(index, next)} />

            {error !== null && <p className={styles.error}>{error}</p>}
          </div>
        );
      })}

      <div className={styles.addBar}>
        {(Object.keys(TYPE_LABEL) as DraftBlock['type'][]).map((type) => (
          <button key={type} type="button" className={styles.addButton} onClick={() => add(type)}>
            + {TYPE_LABEL[type]}
          </button>
        ))}
      </div>
    </div>
  );
}

function BlockFields({
  block,
  onChange,
}: {
  readonly block: DraftBlock;
  readonly onChange: (block: DraftBlock) => void;
}): React.JSX.Element {
  switch (block.type) {
    case 'p':
    case 'h2':
    case 'h3':
    case 'quote':
      return (
        <textarea
          className={styles.textarea}
          aria-label={TYPE_LABEL[block.type]}
          value={block.text}
          onChange={(event) => onChange({ ...block, text: event.target.value })}
          rows={block.type === 'p' || block.type === 'quote' ? 4 : 1}
        />
      );
    case 'code':
      return (
        <div className={styles.fieldGroup}>
          <input
            type="text"
            placeholder="linguagem (opcional)"
            aria-label="Linguagem"
            className={styles.input}
            value={block.lang ?? ''}
            onChange={(event) => onChange({ ...block, lang: event.target.value === '' ? null : event.target.value })}
          />
          <textarea
            className={styles.textareaMono}
            aria-label="Código"
            value={block.text}
            onChange={(event) => onChange({ ...block, text: event.target.value })}
            rows={6}
          />
        </div>
      );
    case 'list':
      return <ListFields block={block} onChange={onChange} />;
    case 'img':
      return <ImageFields block={block} onChange={onChange} />;
  }
}

function ListFields({
  block,
  onChange,
}: {
  readonly block: Extract<DraftBlock, { type: 'list' }>;
  readonly onChange: (block: DraftBlock) => void;
}): React.JSX.Element {
  return (
    <div className={styles.fieldGroup}>
      <label className={styles.checkboxLabel}>
        <input
          type="checkbox"
          checked={block.ordered}
          onChange={(event) => onChange({ ...block, ordered: event.target.checked })}
        />
        Numerada
      </label>
      {block.items.map((item, index) => (
        <div key={index} className={styles.listItemRow}>
          <input
            type="text"
            className={styles.input}
            value={item}
            onChange={(event) => {
              const items = block.items.map((current, i) => (i === index ? event.target.value : current));
              onChange({ ...block, items });
            }}
          />
          <button
            type="button"
            onClick={() => onChange({ ...block, items: block.items.filter((_, i) => i !== index) })}
            aria-label="Remover item"
          >
            ✕
          </button>
        </div>
      ))}
      <button type="button" className={styles.addButton} onClick={() => onChange({ ...block, items: [...block.items, ''] })}>
        + item
      </button>
    </div>
  );
}

function ImageFields({
  block,
  onChange,
}: {
  readonly block: Extract<DraftBlock, { type: 'img' }>;
  readonly onChange: (block: DraftBlock) => void;
}): React.JSX.Element {
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File): Promise<void> {
    setUploading(true);
    try {
      const media = await api.uploadMedia(file, block.alt);
      onChange({ ...block, url: media.url, mediaId: media.id });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className={styles.fieldGroup}>
      <input
        type="text"
        placeholder="URL da imagem"
        className={styles.input}
        value={block.url}
        onChange={(event) => onChange({ ...block, url: event.target.value, mediaId: null })}
      />
      <input
        type="file"
        accept="image/*"
        disabled={uploading}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file !== undefined) void handleFile(file);
        }}
      />
      {uploading && <span className={styles.uploading}>Enviando…</span>}
      <input
        type="text"
        placeholder="Texto alternativo"
        className={styles.input}
        value={block.alt}
        onChange={(event) => onChange({ ...block, alt: event.target.value })}
      />
      <input
        type="text"
        placeholder="Legenda (opcional)"
        className={styles.input}
        value={block.caption ?? ''}
        onChange={(event) => onChange({ ...block, caption: event.target.value === '' ? null : event.target.value })}
      />
      {block.url !== '' && <img src={block.url} alt={block.alt} className={styles.preview} />}
    </div>
  );
}

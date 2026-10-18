import { useState } from 'react';

import { CATEGORIES } from '../core/types';
import type { Category } from '../core/types';
import { CATEGORY_LABEL, STATUS_LABEL } from './categoryLabels';
import styles from './MetaPanel.module.css';
import { TagInput } from './TagInput';
import type { AdminPublication } from './api';
import type { PublicationEditorState, SaveStatus } from './usePublicationEditor';

export interface MetaPanelProps {
  readonly publication: AdminPublication;
  readonly editor: PublicationEditorState;
  readonly onDeleted: (id: number) => void;
}

const STATUS_PILL_LABEL: Record<SaveStatus, string> = {
  idle: '',
  saving: 'Salvando…',
  saved: 'Salvo',
  error: 'Erro ao salvar',
};

export function MetaPanel({ publication, editor, onDeleted }: MetaPanelProps): React.JSX.Element {
  const [armedDelete, setArmedDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handlePublish(): Promise<void> {
    setBusy(true);
    setActionError(null);
    try {
      await editor.publish();
    } catch {
      setActionError('Não foi possível publicar.');
    } finally {
      setBusy(false);
    }
  }

  async function handleUnpublish(): Promise<void> {
    setBusy(true);
    setActionError(null);
    try {
      await editor.unpublish();
    } catch {
      setActionError('Não foi possível despublicar.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(): Promise<void> {
    if (!armedDelete) {
      setArmedDelete(true);
      return;
    }
    setBusy(true);
    try {
      await editor.destroy();
      onDeleted(publication.id);
    } catch {
      setActionError('Não foi possível apagar.');
      setBusy(false);
    }
  }

  const seoTitle = editor.currentDraft.seoTitle !== '' ? editor.currentDraft.seoTitle : editor.currentDraft.title;
  const seoDescription =
    editor.currentDraft.seoDescription !== '' ? editor.currentDraft.seoDescription : editor.currentDraft.subtitle;

  return (
    <div className={styles.column}>
      <div className={styles.statusRow}>
        <span className={styles[`pill_${publication.status}`]}>{STATUS_LABEL[publication.status]}</span>
        {STATUS_PILL_LABEL[editor.status] !== '' && (
          <span className={styles.savePill}>{STATUS_PILL_LABEL[editor.status]}</span>
        )}
      </div>

      <label className={styles.field}>
        <span className={styles.label}>Slug</span>
        <input
          type="text"
          className={styles.input}
          value={editor.slug}
          onChange={(event) => editor.setSlug(event.target.value)}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Categoria</span>
        <select
          className={styles.input}
          value={editor.category}
          onChange={(event) => editor.setCategory(event.target.value as Category)}
        >
          {CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {CATEGORY_LABEL[category]}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Data de publicação (UTC)</span>
        <input
          type="datetime-local"
          className={styles.input}
          value={editor.publishedAt.slice(0, 16)}
          // Direto, sem passar por `Date`: um datetime-local não leva fuso, e o
          // `Date` do navegador o interpretaria como hora local, deslocando o
          // valor. `publishedAt` é sempre UTC (ver PublicationInput.publishedAt).
          onChange={(event) => editor.setPublishedAt(`${event.target.value}:00.000Z`)}
        />
      </label>

      <label className={styles.toggle}>
        <input type="checkbox" checked={editor.featured} onChange={(event) => editor.setFeatured(event.target.checked)} />
        Destaque
      </label>

      <label className={styles.toggle}>
        <input
          type="checkbox"
          checked={editor.indexable}
          onChange={(event) => editor.setIndexable(event.target.checked)}
        />
        Indexável (sai do sitemap e ganha noindex quando desligado)
      </label>

      <div className={styles.field}>
        <span className={styles.label}>Tags</span>
        <TagInput tags={editor.tags} onChange={editor.setTags} />
      </div>

      <div className={styles.seo}>
        <h2 className={styles.sectionTitle}>SEO</h2>
        <label className={styles.field}>
          <span className={styles.label}>Título de SEO (opcional)</span>
          <input
            type="text"
            className={styles.input}
            placeholder={editor.currentDraft.title}
            value={editor.currentDraft.seoTitle}
            onChange={(event) => editor.setCurrentDraft({ seoTitle: event.target.value })}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Descrição de SEO (opcional)</span>
          <textarea
            className={styles.input}
            rows={3}
            placeholder={editor.currentDraft.subtitle}
            value={editor.currentDraft.seoDescription}
            onChange={(event) => editor.setCurrentDraft({ seoDescription: event.target.value })}
          />
        </label>
        <div className={styles.seoPreview}>
          <p className={styles.seoPreviewTitle}>{seoTitle === '' ? '(sem título)' : seoTitle}</p>
          <p className={styles.seoPreviewUrl}>rdmlabs.dev/pt/publicacoes/{editor.slug}</p>
          <p className={styles.seoPreviewDescription}>{seoDescription === '' ? '(sem descrição)' : seoDescription}</p>
        </div>
      </div>

      {actionError !== null && <p className={styles.actionError}>{actionError}</p>}

      <div className={styles.actions}>
        {publication.status === 'published' || publication.status === 'scheduled' ? (
          <button type="button" className={styles.secondaryButton} disabled={busy} onClick={() => void handleUnpublish()}>
            Despublicar
          </button>
        ) : (
          <button type="button" className={styles.primaryButton} disabled={busy} onClick={() => void handlePublish()}>
            Publicar
          </button>
        )}
        <button type="button" className={styles.dangerButton} disabled={busy} onClick={() => void handleDelete()}>
          {armedDelete ? 'Confirmar exclusão' : 'Apagar'}
        </button>
      </div>
    </div>
  );
}

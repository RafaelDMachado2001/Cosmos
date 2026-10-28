import { useState } from 'react';

import { ArticleBody } from '../components/ArticleBody/ArticleBody';
import { blocksToDraftBlocks, draftBlocksToMarkdown } from '../core/draftBlocks';
import { wordCount } from '../core/draftValidation';
import { LOCALES } from '../core/types';
import type { Locale } from '../core/types';
import { BlockEditor } from './BlockEditor';
import styles from './PublicationEditor.module.css';
import type { PublicationEditorState } from './usePublicationEditor';

export interface PublicationEditorProps {
  readonly editor: PublicationEditorState;
}

const LOCALE_LABEL: Record<Locale, string> = { pt: 'Português', en: 'English' };

export function PublicationEditor({ editor }: PublicationEditorProps): React.JSX.Element {
  const [preview, setPreview] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');

  const otherLocale = editor.locale === 'pt' ? 'en' : 'pt';

  return (
    <div className={styles.column}>
      <div className={styles.tabs} role="tablist">
        {LOCALES.map((locale) => (
          <button
            key={locale}
            type="button"
            role="tab"
            aria-selected={editor.locale === locale}
            className={editor.locale === locale ? styles.tabActive : styles.tab}
            onClick={() => editor.setLocale(locale)}
          >
            {LOCALE_LABEL[locale]}
          </button>
        ))}
        <button
          type="button"
          className={styles.copyButton}
          onClick={() => editor.copyStructureFrom(otherLocale)}
        >
          Copiar de {LOCALE_LABEL[otherLocale]}
        </button>
      </div>

      <input
        type="text"
        className={styles.titleInput}
        placeholder="Título"
        value={editor.currentDraft.title}
        onChange={(event) => editor.setCurrentDraft({ title: event.target.value })}
      />
      <textarea
        className={styles.subtitleInput}
        placeholder="Subtítulo — aparece no cartão de hover e na meta description"
        rows={2}
        value={editor.currentDraft.subtitle}
        onChange={(event) => editor.setCurrentDraft({ subtitle: event.target.value })}
      />

      <div className={styles.toolbar}>
        <span className={styles.wordCount}>{wordCount(editor.currentDraft.blocks)} palavras</span>
        <button type="button" className={styles.toolbarButton} onClick={() => setImportOpen((open) => !open)}>
          Importar Markdown
        </button>
        <button type="button" className={styles.toolbarButton} onClick={() => setPreview((value) => !value)}>
          {preview ? 'Editar' : 'Pré-visualizar'}
        </button>
      </div>

      {importOpen && (
        <div className={styles.importPanel}>
          <textarea
            className={styles.importTextarea}
            rows={8}
            placeholder="Cole aqui o Markdown (##, > , - , ```, ![alt](url))"
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
          />
          <button
            type="button"
            className={styles.toolbarButton}
            onClick={() => {
              editor.setCurrentDraft({ blocks: blocksToDraftBlocks(importText) });
              setImportText('');
              setImportOpen(false);
            }}
          >
            Importar
          </button>
        </div>
      )}

      {preview ? (
        <div className={styles.preview} data-brand="cosmos">
          <ArticleBody markdown={draftBlocksToMarkdown(editor.currentDraft.blocks)} />
        </div>
      ) : (
        <BlockEditor
          blocks={editor.currentDraft.blocks}
          onChange={(blocks) => editor.setCurrentDraft({ blocks })}
        />
      )}

      <ReferencesEditor editor={editor} />
    </div>
  );
}

function ReferencesEditor({ editor }: { readonly editor: PublicationEditorState }): React.JSX.Element {
  return (
    <div className={styles.references}>
      <h2 className={styles.sectionTitle}>Referências</h2>
      {editor.references.map((reference, index) => (
        <div key={reference.id} className={styles.referenceRow}>
          <input
            type="text"
            placeholder="Título"
            className={styles.referenceInput}
            value={reference.title}
            onChange={(event) => {
              const next = editor.references.map((current, i) =>
                i === index ? { ...current, title: event.target.value } : current,
              );
              editor.setReferences(next);
            }}
          />
          <input
            type="text"
            placeholder="URL"
            className={styles.referenceInput}
            value={reference.url}
            onChange={(event) => {
              const next = editor.references.map((current, i) =>
                i === index ? { ...current, url: event.target.value } : current,
              );
              editor.setReferences(next);
            }}
          />
          <button
            type="button"
            onClick={() => editor.setReferences(editor.references.filter((_, i) => i !== index))}
            aria-label="Remover referência"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        className={styles.toolbarButton}
        onClick={() =>
          editor.setReferences([
            ...editor.references,
            { id: -Date.now(), position: editor.references.length, title: '', url: '' },
          ])
        }
      >
        + Referência
      </button>
    </div>
  );
}

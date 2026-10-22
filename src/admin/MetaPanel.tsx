import { useState } from 'react';

import { DEFAULT_APPEARANCE, NEBULA_MAX } from '../core/appearance';
import { articlePath } from '../core/routing';
import { CATEGORIES } from '../core/types';
import type { Category } from '../core/types';
import { CategoryTheme } from '../components/CategoryTheme/CategoryTheme';
import { Nebula } from '../components/Nebula/Nebula';
import { CATEGORY_LABEL, STATUS_LABEL } from './categoryLabels';
import styles from './MetaPanel.module.css';
import { siteHost, siteOrigin } from './site';
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

  const live = publication.status === 'published' || publication.status === 'scheduled';

  async function handlePublish(): Promise<void> {
    setBusy(true);
    setActionError(null);
    try {
      await editor.publish();
    } catch {
      setActionError(live ? 'Não foi possível atualizar o publicado.' : 'Não foi possível publicar.');
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
  const siteUrl = document.querySelector('meta[name="site-url"]')?.getAttribute('content') ?? null;
  const host = siteHost(siteUrl, window.location.host);
  // Data futura e ainda fora do ar: o mesmo `publish` agenda em vez de
  // publicar (o servidor marca `scheduled`), e o botão diz isso.
  const schedules = !live && Date.parse(editor.publishedAt) > Date.now();

  return (
    <div className={styles.column}>
      <div className={styles.statusRow}>
        <span className={styles[`pill_${publication.status}`]}>{STATUS_LABEL[publication.status]}</span>
        {STATUS_PILL_LABEL[editor.status] !== '' && (
          <span className={styles.savePill}>{STATUS_PILL_LABEL[editor.status]}</span>
        )}
      </div>
      {live && publication.pendingChanges && (
        <p className={styles.pendingNote} role="status">
          Há alterações salvas que ainda não estão no ar.
        </p>
      )}

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

      <AppearanceSection editor={editor} />

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
          <p className={styles.seoPreviewUrl}>
            {host}
            {articlePath(editor.locale, editor.slug)}
          </p>
          <p className={styles.seoPreviewDescription}>{seoDescription === '' ? '(sem descrição)' : seoDescription}</p>
        </div>

        {/* A miniatura do og:image que o prerender desenha (src/prerender/og.tsx):
            mesma estrela, mesma posição, mesmo título. Abaixo, o que a rede
            social escreve embaixo da imagem. */}
        <span className={styles.label}>Prévia do card</span>
        <div className={styles.cardPreview}>
          <div
            className={styles.cardImage}
            style={{ '--card-accent': `var(--color-cat-${editor.category})` } as React.CSSProperties}
          >
            <span className={styles.cardAura} aria-hidden="true" />
            <span className={styles.cardStar} aria-hidden="true" />
            <span className={styles.cardKicker}>{CATEGORY_LABEL[editor.category]}</span>
            <span className={styles.cardTitle}>{editor.currentDraft.title === '' ? '(sem título)' : editor.currentDraft.title}</span>
            <span className={styles.cardFooter}>RDM Labs / Cosmos</span>
          </div>
          <div className={styles.cardMeta}>
            <span className={styles.cardHost}>{host.toUpperCase()}</span>
            <span className={styles.cardMetaTitle}>{seoTitle === '' ? '(sem título)' : seoTitle}</span>
            <span className={styles.cardMetaDescription}>{seoDescription === '' ? '(sem descrição)' : seoDescription}</span>
          </div>
        </div>
        <ShareRow
          enabled={publication.status === 'published'}
          url={`${siteOrigin(siteUrl, window.location.origin)}${articlePath(editor.locale, editor.slug)}`}
          title={seoTitle}
          text={seoDescription}
        />
      </div>

      {actionError !== null && <p className={styles.actionError}>{actionError}</p>}

      <div className={styles.actions}>
        {live ? (
          <button
            type="button"
            className={styles.primaryButton}
            // Habilitado mesmo sem pendência acusada: o autosave pode estar a
            // caminho, e republicar o mesmo conteúdo é inofensivo.
            disabled={busy}
            onClick={() => void handlePublish()}
          >
            Atualizar publicado
          </button>
        ) : (
          <button type="button" className={styles.primaryButton} disabled={busy} onClick={() => void handlePublish()}>
            {schedules ? 'Agendar' : 'Publicar'}
          </button>
        )}
      </div>
      <div className={styles.actionsSecondary}>
        {live && (
          <button type="button" className={styles.secondaryButton} disabled={busy} onClick={() => void handleUnpublish()}>
            Despublicar
          </button>
        )}
        <button type="button" className={styles.dangerButton} disabled={busy} onClick={() => void handleDelete()}>
          {armedDelete ? 'Confirmar exclusão' : 'Apagar'}
        </button>
      </div>
    </div>
  );
}

type ShareFeedback = 'idle' | 'copied' | 'failed';

/**
 * O link do artigo, para mandar adiante. O card não vai junto como arquivo:
 * quem desenha a prévia é a rede social, lendo o `og:image` da página — o
 * mesmo cartão que a prévia acima imita. Só com a publicação no ar: agendada,
 * o link ainda daria 404.
 */
function ShareRow({
  enabled,
  url,
  title,
  text,
}: {
  readonly enabled: boolean;
  readonly url: string;
  readonly title: string;
  readonly text: string;
}): React.JSX.Element {
  const [feedback, setFeedback] = useState<ShareFeedback>('idle');
  // A folha de compartilhamento do sistema só existe em parte dos navegadores
  // (e só em contexto seguro); sem ela, copiar o link é o caminho.
  const canShare = typeof navigator.share === 'function';

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
      setFeedback('copied');
    } catch {
      setFeedback('failed');
    }
  }

  async function share(): Promise<void> {
    try {
      await navigator.share({ url, title, text });
    } catch {
      // Fechar a folha sem escolher nada também rejeita; não é erro.
    }
  }

  return (
    <div className={styles.shareRow}>
      {canShare && (
        <button type="button" className={styles.secondaryButton} disabled={!enabled} onClick={() => void share()}>
          Compartilhar
        </button>
      )}
      <button type="button" className={styles.secondaryButton} disabled={!enabled} onClick={() => void copy()}>
        Copiar link
      </button>
      <span className={styles.shareNote} role="status">
        {!enabled
          ? 'Disponível com a publicação no ar.'
          : feedback === 'copied'
            ? 'Link copiado.'
            : feedback === 'failed'
              ? url
              : ''}
      </span>
    </div>
  );
}

/**
 * A nebulosa e o movimento da tela de leitura. "Herdar" grava nulo: a
 * publicação segue o padrão (`core/appearance.ts`) e muda junto com ele.
 * A prévia é o topo do artigo, com os mesmos `CategoryTheme` e `Nebula`.
 */
function AppearanceSection({ editor }: { readonly editor: PublicationEditorState }): React.JSX.Element {
  const inherit = editor.appearance === null;
  const current = editor.appearance ?? DEFAULT_APPEARANCE;
  const title = editor.currentDraft.title === '' ? '(sem título)' : editor.currentDraft.title;

  return (
    <div className={styles.field}>
      <span className={styles.label}>Aparência</span>
      <label className={styles.toggle}>
        <input
          type="checkbox"
          checked={inherit}
          onChange={(event) => editor.setAppearance(event.target.checked ? null : DEFAULT_APPEARANCE)}
        />
        Herdar da categoria
      </label>
      <label className={styles.rangeField}>
        <span className={styles.rangeHead}>
          <span>Intensidade da nebulosa</span>
          <span className={styles.rangeValue}>{current.nebula.toFixed(2)}</span>
        </span>
        <input
          type="range"
          min={0}
          max={NEBULA_MAX}
          step={0.05}
          disabled={inherit}
          value={current.nebula}
          onChange={(event) => editor.setAppearance({ ...current, nebula: Number(event.target.value) })}
        />
      </label>
      <label className={styles.toggle}>
        <input
          type="checkbox"
          disabled={inherit}
          checked={current.motion}
          onChange={(event) => editor.setAppearance({ ...current, motion: event.target.checked })}
        />
        Movimento
      </label>

      <CategoryTheme category={editor.category} className={styles.appearancePreview}>
        <Nebula seed={editor.slug} variant="wide" intensity={current.nebula * 0.85} motion={current.motion} />
        <span className={styles.appearanceKicker}>{CATEGORY_LABEL[editor.category]}</span>
        <span className={styles.appearanceTitle}>{title}</span>
        <span className={styles.appearanceFilet} aria-hidden="true" />
      </CategoryTheme>
    </div>
  );
}

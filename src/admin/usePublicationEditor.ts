import { useEffect, useMemo, useRef, useState } from 'react';

import type { DraftBlock } from '../core/draftBlocks';
import { slugify } from '../core/slug';
import { LOCALES } from '../core/types';
import type { Category, Locale } from '../core/types';
import { api } from './api';
import type { AdminPublication, AdminReference, DraftPatch, PublicationPatch } from './api';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface DraftFields {
  readonly title: string;
  readonly subtitle: string;
  readonly blocks: readonly DraftBlock[];
  readonly seoTitle: string;
  readonly seoDescription: string;
}

type DraftsByLocale = Record<Locale, DraftFields>;

const EMPTY_DRAFT: DraftFields = { title: '', subtitle: '', blocks: [], seoTitle: '', seoDescription: '' };

function draftsFrom(publication: AdminPublication): DraftsByLocale {
  const result = {} as DraftsByLocale;
  for (const locale of LOCALES) {
    const draft = publication.drafts[locale];
    result[locale] =
      draft === undefined
        ? EMPTY_DRAFT
        : {
            title: draft.title ?? '',
            subtitle: draft.subtitle ?? '',
            blocks: draft.blocks,
            seoTitle: draft.seoTitle ?? '',
            seoDescription: draft.seoDescription ?? '',
          };
  }
  return result;
}

const AUTOSAVE_DELAY_MS = 400;

/** O prefixo que `AdminApp.create()` usa para o slug provisório de uma publicação nova. */
export const PLACEHOLDER_SLUG_PREFIX = 'rascunho-';

function isPlaceholderSlug(slug: string): boolean {
  return slug.startsWith(PLACEHOLDER_SLUG_PREFIX);
}

/**
 * Todo o estado editável de uma publicação, com autosave debounced.
 *
 * Um clone local por seleção (ver o `key={publication.id}` em `AdminApp`,
 * que remonta este hook a cada troca) — edita-se a cópia, nunca a prop
 * direto, e o efeito abaixo é quem decide quando mandar para o servidor.
 */
export function usePublicationEditor(
  publication: AdminPublication,
  onUpdated: (updated: AdminPublication) => void,
) {
  const [locale, setLocale] = useState<Locale>('pt');
  const [slug, setSlug] = useState(publication.slug);
  const [category, setCategory] = useState<Category>(publication.category);
  const [publishedAt, setPublishedAt] = useState(publication.publishedAt);
  const [featured, setFeatured] = useState(publication.featured);
  const [indexable, setIndexable] = useState(publication.indexable);
  const [tags, setTags] = useState<readonly string[]>(publication.tags);
  const [references, setReferences] = useState<readonly AdminReference[]>(publication.references);
  const [drafts, setDrafts] = useState<DraftsByLocale>(() => draftsFrom(publication));
  const [status, setStatus] = useState<SaveStatus>('idle');
  /**
   * `false` só é possível vindo de `AdminApp`'s create flow (slug-placeholder
   * ainda não editado à mão) — ver `isNewSlug`. Uma vez editado o slug à
   * mão, ou numa publicação já existente, o automático nunca mais escreve
   * em cima.
   */
  const [slugTouched, setSlugTouched] = useState(!isPlaceholderSlug(publication.slug));

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Primeira renderização depois de selecionar: não autosalva o que acabou
  // de chegar do servidor, só o que a pessoa edita a partir daqui.
  const skipNext = useRef(true);

  function setCurrentDraft(patch: Partial<DraftFields>): void {
    setDrafts((prev) => ({ ...prev, [locale]: { ...prev[locale], ...patch } }));
    // O slug automático só segue o título em português — é o que decide a
    // posição da estrela, e trocar de aba não deveria reescrevê-lo.
    if (locale === 'pt' && patch.title !== undefined && !slugTouched) {
      setSlug(slugify(patch.title));
    }
  }

  function copyStructureFrom(source: Locale): void {
    const sourceDraft = drafts[source];
    setCurrentDraft({
      blocks: sourceDraft.blocks.map((block, index) => ({ ...block, id: `b${String(index)}` })),
    });
  }

  useEffect(() => {
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }

    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setStatus('saving');

      const draftPatches: Partial<Record<Locale, DraftPatch>> = {};
      for (const loc of LOCALES) {
        const draft = drafts[loc];
        draftPatches[loc] = {
          title: draft.title,
          subtitle: draft.subtitle,
          blocks: draft.blocks,
          seoTitle: draft.seoTitle === '' ? null : draft.seoTitle,
          seoDescription: draft.seoDescription === '' ? null : draft.seoDescription,
        };
      }

      const patch: PublicationPatch = {
        slug,
        category,
        publishedAt,
        featured,
        indexable,
        tags,
        references: references.map((reference) => ({ title: reference.title, url: reference.url })),
        drafts: draftPatches,
      };

      api
        .update(publication.id, patch)
        .then((updated) => {
          setStatus('saved');
          onUpdated(updated);
        })
        .catch(() => setStatus('error'));
    }, AUTOSAVE_DELAY_MS);

    return () => {
      if (timer.current !== null) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- publication.id/onUpdated são estáveis por seleção; o efeito reage ao conteúdo editado.
  }, [slug, category, publishedAt, featured, indexable, tags, references, drafts]);

  const currentDraft = useMemo(() => drafts[locale], [drafts, locale]);

  async function publish(): Promise<AdminPublication> {
    const updated = await api.publish(publication.id);
    onUpdated(updated);
    return updated;
  }

  async function unpublish(): Promise<AdminPublication> {
    const updated = await api.unpublish(publication.id);
    onUpdated(updated);
    return updated;
  }

  async function destroy(): Promise<void> {
    await api.destroy(publication.id);
  }

  return {
    locale,
    setLocale,
    slug,
    setSlug: (value: string) => {
      setSlugTouched(true);
      setSlug(value);
    },
    slugTouched,
    category,
    setCategory,
    publishedAt,
    setPublishedAt,
    featured,
    setFeatured,
    indexable,
    setIndexable,
    tags,
    setTags,
    references,
    setReferences,
    currentDraft,
    setCurrentDraft,
    copyStructureFrom,
    status,
    publish,
    unpublish,
    destroy,
  };
}

export type PublicationEditorState = ReturnType<typeof usePublicationEditor>;

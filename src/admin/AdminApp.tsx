import { useCallback, useEffect, useState } from 'react';

import styles from './AdminApp.module.css';
import { MetaPanel } from './MetaPanel';
import { PublicationEditor } from './PublicationEditor';
import { PLACEHOLDER_SLUG_PREFIX, usePublicationEditor } from './usePublicationEditor';
import { PublicationList } from './PublicationList';
import { api } from './api';
import type { AdminPublication } from './api';
import { searchForSelected } from './selection';

/** A publicação selecionada: busca a lista uma vez e edita localmente a partir daí. */
function EditorPane({
  publication,
  onUpdated,
  onDeleted,
}: {
  readonly publication: AdminPublication;
  readonly onUpdated: (updated: AdminPublication) => void;
  readonly onDeleted: (id: number) => void;
}): React.JSX.Element {
  const editor = usePublicationEditor(publication, onUpdated);
  return (
    <>
      <PublicationEditor editor={editor} />
      <MetaPanel publication={publication} editor={editor} onDeleted={onDeleted} />
    </>
  );
}

export function AdminApp({
  initialSelectedId = null,
}: {
  /** Vem de `?publication=` (ver `selection.ts`): o link do Filament abre direto nela. */
  readonly initialSelectedId?: number | null;
} = {}): React.JSX.Element {
  const [publications, setPublications] = useState<readonly AdminPublication[] | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(initialSelectedId);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    api
      .list()
      .then(setPublications)
      .catch(() => setError('Não foi possível carregar o acervo.'));
  }, []);

  useEffect(() => reload(), [reload]);

  // Um id do endereço que não está no acervo (apagado, link velho) vira estado vazio.
  useEffect(() => {
    if (
      publications !== null &&
      selectedId !== null &&
      !publications.some((item) => item.id === selectedId)
    ) {
      setSelectedId(null);
    }
  }, [publications, selectedId]);

  // O endereço acompanha a seleção: recarregar volta para a mesma publicação.
  useEffect(() => {
    const search = searchForSelected(window.location.search, selectedId);
    if (search !== window.location.search) {
      window.history.replaceState(null, '', `${window.location.pathname}${search}`);
    }
  }, [selectedId]);

  function handleUpdated(updated: AdminPublication): void {
    setPublications(
      (prev) => prev?.map((item) => (item.id === updated.id ? updated : item)) ?? prev,
    );
  }

  function handleDeleted(id: number): void {
    setPublications((prev) => prev?.filter((item) => item.id !== id) ?? prev);
    setSelectedId(null);
  }

  async function handleCreate(): Promise<void> {
    try {
      const created = await api.create({
        slug: `${PLACEHOLDER_SLUG_PREFIX}${String(Date.now())}`,
        category: 'artigo',
        publishedAt: new Date().toISOString(),
      });
      setPublications((prev) => (prev === null ? [created] : [created, ...prev]));
      setSelectedId(created.id);
    } catch {
      setError('Não foi possível criar a publicação.');
    }
  }

  if (error !== null) return <div className={styles.loading}>{error}</div>;
  if (publications === null) return <div className={styles.loading}>Carregando…</div>;

  const selected = publications.find((item) => item.id === selectedId) ?? null;

  return (
    <div className={styles.shell}>
      <PublicationList
        publications={publications}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onCreate={() => void handleCreate()}
      />
      {selected === null ? (
        <div className={styles.empty}>Selecione uma publicação ou crie uma nova.</div>
      ) : (
        <EditorPane
          key={selected.id}
          publication={selected}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}

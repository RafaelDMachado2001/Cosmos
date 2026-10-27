// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { usePublications } from './usePublications';
import type { PublicationSummary } from '../core/types';
import type { PublicationsSource } from '../data/PublicationsSource';
import type { SnapshotLoader } from '../data/snapshotLoader';

function summary(slug: string): PublicationSummary {
  return {
    slug,
    publishedAt: '2025-09-12T12:00:00.000Z',
    category: 'rotina',
    title: slug,
    summary: '',
  };
}

const FROM_SNAPSHOT = [summary('do-build')];
const FROM_API = [summary('do-build'), summary('publicada-depois')];

/** Uma promessa que o teste resolve ou rejeita quando quiser. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function sourceFrom(list: () => Promise<readonly PublicationSummary[]>): PublicationsSource {
  return { list, get: () => Promise.resolve(null) };
}

/*
 * Fonte e snapshot são criados fora do callback do renderHook em todos os
 * testes: objetos novos a cada render mudariam as dependências do efeito e o
 * carregamento recomeçaria sem fim — no Shell, os dois vêm de `useMemo`.
 */
const slugs = (items: readonly PublicationSummary[]) => items.map((item) => item.slug);

describe('usePublications', () => {
  afterEach(() => {
    cleanup();
  });

  it('abre com o snapshot enquanto a API não responde, e troca quando ela responde', async () => {
    const api = deferred<readonly PublicationSummary[]>();
    const snapshot: SnapshotLoader = () => Promise.resolve(FROM_SNAPSHOT);
    const source = sourceFrom(() => api.promise);
    const { result } = renderHook(() => usePublications(source, 'pt', snapshot));

    await waitFor(() => {
      expect(result.current.state.status).toBe('ready');
    });
    expect(slugs(result.current.state.items)).toEqual(['do-build']);

    await act(async () => {
      api.resolve(FROM_API);
      await api.promise;
    });
    expect(slugs(result.current.state.items)).toEqual(['do-build', 'publicada-depois']);
  });

  it('com a API fora do ar, fica com o snapshot e não mostra erro', async () => {
    const api = deferred<readonly PublicationSummary[]>();
    const snapshot: SnapshotLoader = () => Promise.resolve(FROM_SNAPSHOT);
    const source = sourceFrom(() => api.promise);
    const { result } = renderHook(() => usePublications(source, 'pt', snapshot));
    await waitFor(() => {
      expect(result.current.state.status).toBe('ready');
    });

    await act(async () => {
      api.reject(new Error('503'));
      await api.promise.catch(() => undefined);
    });
    expect(result.current.state.status).toBe('ready');
    expect(slugs(result.current.state.items)).toEqual(['do-build']);
  });

  it('a API que falha antes do snapshot chegar espera por ele', async () => {
    const file = deferred<readonly PublicationSummary[] | null>();
    const source = sourceFrom(() => Promise.reject(new Error('timeout')));
    const snapshot: SnapshotLoader = () => file.promise;
    const { result } = renderHook(() => usePublications(source, 'pt', snapshot));
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.state.status).toBe('loading');

    await act(async () => {
      file.resolve(FROM_SNAPSHOT);
      await file.promise;
    });
    expect(result.current.state.status).toBe('ready');
  });

  it('sem snapshot e sem API, aí sim é erro', async () => {
    const source = sourceFrom(() => Promise.reject(new Error('offline')));
    const snapshot: SnapshotLoader = () => Promise.resolve(null);
    const { result } = renderHook(() => usePublications(source, 'pt', snapshot));
    await waitFor(() => {
      expect(result.current.state.status).toBe('error');
    });
  });

  it('um snapshot que chega depois da API não a sobrescreve', async () => {
    const file = deferred<readonly PublicationSummary[] | null>();
    const source = sourceFrom(() => Promise.resolve(FROM_API));
    const snapshot: SnapshotLoader = () => file.promise;
    const { result } = renderHook(() => usePublications(source, 'pt', snapshot));
    await waitFor(() => {
      expect(result.current.state.status).toBe('ready');
    });

    await act(async () => {
      file.resolve(FROM_SNAPSHOT);
      await file.promise;
    });
    expect(slugs(result.current.state.items)).toEqual(['do-build', 'publicada-depois']);
  });

  it('sem carregador de snapshot, segue só a fonte (acervo semente)', async () => {
    const source = sourceFrom(() => Promise.resolve(FROM_API));
    const { result } = renderHook(() => usePublications(source, 'pt'));
    await waitFor(() => {
      expect(result.current.state.status).toBe('ready');
    });
    expect(result.current.state.items).toHaveLength(2);
  });
});

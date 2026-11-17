import { describe, expect, it, vi } from 'vitest';

import { createDetailCache } from './detailCache';
import type { PublicationDetail, PublicationsSource } from './PublicationsSource';

function detail(slug: string): PublicationDetail {
  return {
    slug,
    publishedAt: '2025-01-01T00:00:00Z',
    category: 'artigo',
    title: slug,
    summary: '',
    body: 'Texto.',
    locales: ['pt'],
    tags: [],
  };
}

function sourceWith(get: PublicationsSource['get']): PublicationsSource {
  return { list: () => Promise.resolve([]), get };
}

describe('createDetailCache', () => {
  it('pré-buscar e depois abrir faz uma chamada só', async () => {
    const get = vi.fn((slug: string) => Promise.resolve(detail(slug)));
    const cache = createDetailCache(sourceWith(get));

    cache.prefetch('a', 'pt');
    cache.prefetch('a', 'pt');
    expect(await cache.get('a', 'pt')).toEqual(detail('a'));
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('o que já chegou fica disponível sem esperar', async () => {
    const cache = createDetailCache(sourceWith((slug) => Promise.resolve(detail(slug))));

    expect(cache.peek('a', 'pt')).toBeUndefined();
    await cache.get('a', 'pt');
    expect(cache.peek('a', 'pt')).toEqual(detail('a'));
    expect(cache.peek('a', 'en')).toBeUndefined();
  });

  it('falha e ausência não ficam guardadas: a próxima abertura tenta de novo', async () => {
    const get = vi
      .fn<PublicationsSource['get']>()
      .mockRejectedValueOnce(new Error('rede'))
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(detail('a'));
    const cache = createDetailCache(sourceWith(get));

    cache.prefetch('a', 'pt');
    await expect(cache.get('a', 'pt')).rejects.toThrow('rede');
    expect(await cache.get('a', 'pt')).toBeNull();
    expect(await cache.get('a', 'pt')).toEqual(detail('a'));
    expect(get).toHaveBeenCalledTimes(3);
  });

  it('pré-busca que falha não lança', async () => {
    const cache = createDetailCache(sourceWith(() => Promise.reject(new Error('rede'))));
    expect(() => {
      cache.prefetch('a', 'pt');
    }).not.toThrow();
    await Promise.resolve();
  });
});

import { describe, expect, it } from 'vitest';

import { createSnapshotLoader } from './snapshotLoader';
import type { PublicationSummary } from '../core/types';

const SUMMARY: PublicationSummary = {
  slug: 'code-review-sem-atrito',
  publishedAt: '2025-09-12T12:00:00.000Z',
  category: 'rotina',
  title: 'Code review sem atrito',
  summary: 'Comentar o código, não a pessoa.',
};

function serving(reply: { status?: number; body?: unknown } | Error) {
  const urls: string[] = [];
  const impl = (url: string): Promise<Response> => {
    urls.push(url);
    if (reply instanceof Error) return Promise.reject(reply);
    const status = reply.status ?? 200;
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(reply.body),
    } as Response);
  };
  return { urls, impl: impl as unknown as typeof fetch };
}

describe('createSnapshotLoader', () => {
  it('pede o arquivo do idioma e devolve as publicações', async () => {
    const { urls, impl } = serving({ body: [SUMMARY] });
    expect(await createSnapshotLoader(impl)('en')).toEqual([SUMMARY]);
    expect(urls).toEqual(['/data/publications.en.json']);
  });

  it('arquivo ausente é ausência de snapshot, sem nova tentativa', async () => {
    const { urls, impl } = serving({ status: 404 });
    expect(await createSnapshotLoader(impl)('pt')).toBeNull();
    expect(urls).toHaveLength(1);
  });

  it('falha de rede e conteúdo inválido também viram null, nunca exceção', async () => {
    expect(await createSnapshotLoader(serving(new TypeError('offline')).impl)('pt')).toBeNull();
    expect(await createSnapshotLoader(serving({ body: '<html>' }).impl)('pt')).toBeNull();
  });
});

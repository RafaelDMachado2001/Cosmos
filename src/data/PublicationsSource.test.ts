import { describe, expect, it } from 'vitest';

import { createHttpSource, createStaticSource } from './PublicationsSource';
import type { PublicationsSource } from './PublicationsSource';
import { PUBLICATIONS } from './publications';
import type { PublicationSummary } from '../core/types';

/**
 * Suíte de contrato. Roda hoje contra o adapter estático; quando o adapter
 * HTTP do Laravel existir, roda contra ele sem alteração. É o que garante que
 * trocar a fonte de dados não muda o comportamento da constelação.
 */
export function describePublicationsSource(name: string, create: () => PublicationsSource): void {
  describe(name, () => {
    const source = create();

    describe('list', () => {
      it('devolve o acervo do mais novo para o mais antigo', async () => {
        const items = await source.list({ locale: 'pt' });
        expect(items).toHaveLength(PUBLICATIONS.length);
        for (let i = 1; i < items.length; i += 1) {
          const previous = Date.parse(items[i - 1]?.publishedAt ?? '');
          expect(Date.parse(items[i]?.publishedAt ?? '')).toBeLessThanOrEqual(previous);
        }
      });

      it('devolve a forma enxuta, sem o corpo do texto', async () => {
        const [item] = await source.list({ locale: 'pt' });
        expect(item).toBeDefined();
        expect(item).not.toHaveProperty('body');
        expect(item).not.toHaveProperty('content');
        expect(typeof item?.title).toBe('string');
        expect(typeof item?.summary).toBe('string');
      });

      it('devolve os textos no idioma pedido', async () => {
        const [pt] = await source.list({ locale: 'pt' });
        const [en] = await source.list({ locale: 'en' });
        expect(pt?.slug).toBe(en?.slug);
        expect(pt?.title).not.toBe(en?.title);
      });

      it('filtra por categoria', async () => {
        const items = await source.list({ locale: 'pt', category: 'projeto' });
        expect(items.length).toBeGreaterThan(0);
        for (const item of items) expect(item.category).toBe('projeto');
      });

      it('trata "all" como ausência de filtro', async () => {
        const todos = await source.list({ locale: 'pt', category: 'all' });
        expect(todos).toHaveLength(PUBLICATIONS.length);
      });

      it('busca por texto livre', async () => {
        const items = await source.list({ locale: 'pt', q: 'postgresql' });
        expect(items.map((item) => item.slug)).toContain('fundamentos-de-indices-no-postgresql');
      });

      it('respeita o limite', async () => {
        expect(await source.list({ locale: 'pt', limit: 3 })).toHaveLength(3);
      });

      it('pagina por janela temporal com before', async () => {
        const all = await source.list({ locale: 'pt' });
        const cutoff = all[2]?.publishedAt;
        if (cutoff === undefined) throw new Error('acervo pequeno demais para o teste');

        const older = await source.list({ locale: 'pt', before: cutoff });
        for (const item of older) {
          expect(Date.parse(item.publishedAt)).toBeLessThan(Date.parse(cutoff));
        }
        expect(older.length).toBe(all.length - 3);
      });

      it('combina filtros', async () => {
        const items = await source.list({ locale: 'pt', category: 'estudo', q: 'shaders' });
        expect(items.map((item) => item.slug)).toEqual(['shaders-glsl-para-interfaces']);
      });

      it('devolve vazio quando nada corresponde, sem lançar', async () => {
        expect(await source.list({ locale: 'pt', q: 'nao-existe-nada-assim' })).toEqual([]);
      });
    });

    describe('get', () => {
      it('devolve a publicação completa, com corpo', async () => {
        const item = await source.get('code-review-sem-atrito', 'pt');
        expect(item?.title).toBe('Code review sem atrito');
        expect(item?.body.length).toBeGreaterThan(0);
      });

      it('devolve o corpo no idioma pedido', async () => {
        const pt = await source.get('code-review-sem-atrito', 'pt');
        const en = await source.get('code-review-sem-atrito', 'en');
        expect(pt?.body).not.toBe(en?.body);
      });

      it('devolve null para slug desconhecido, em vez de lançar', async () => {
        expect(await source.get('slug-que-nao-existe', 'pt')).toBeNull();
      });
    });
  });
}

describePublicationsSource('createStaticSource', () => createStaticSource(PUBLICATIONS));

// ---------------------------------------------------------------------------
// Adapter HTTP
// ---------------------------------------------------------------------------

/** Registra a requisição e devolve o que o teste mandar. Nada de rede. */
function stubFetch(reply: { status?: number; body?: unknown } = {}) {
  const calls: string[] = [];
  const impl = (input: string): Promise<Response> => {
    calls.push(input);
    const status = reply.status ?? 200;
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(reply.body ?? { data: [] }),
    } as Response);
  };
  return { calls, impl: impl as unknown as typeof fetch };
}

const SUMMARY_ROW = {
  slug: 'code-review-sem-atrito',
  category: 'rotina',
  published_at: '2025-09-12T12:00:00.000Z',
  featured: false,
  title: 'Code review sem atrito',
  summary: 'Comentar o código, não a pessoa.',
};

describe('createHttpSource — a lista', () => {
  it('pede o idioma', async () => {
    const { calls, impl } = stubFetch();
    await createHttpSource('https://api.rdmlabs.dev', impl).list({ locale: 'en' });
    expect(calls[0]).toBe('https://api.rdmlabs.dev/api/publications?locale=en');
  });

  it('não duplica a barra quando a base traz uma', async () => {
    const { calls, impl } = stubFetch();
    await createHttpSource('https://api.rdmlabs.dev/', impl).list({ locale: 'pt' });
    expect(calls[0]).toBe('https://api.rdmlabs.dev/api/publications?locale=pt');
  });

  it('manda a categoria só quando há uma', async () => {
    const { calls, impl } = stubFetch();
    const source = createHttpSource('https://x.dev', impl);
    await source.list({ locale: 'pt', category: 'all' });
    await source.list({ locale: 'pt', category: 'estudo' });
    expect(calls[0]).not.toContain('category');
    expect(calls[1]).toContain('category=estudo');
  });

  it('manda a busca só quando há texto', async () => {
    const { calls, impl } = stubFetch();
    const source = createHttpSource('https://x.dev', impl);
    await source.list({ locale: 'pt', q: '   ' });
    await source.list({ locale: 'pt', q: 'índice postgres' });
    expect(calls[0]).not.toContain('q=');
    expect(calls[1]).toContain('q=%C3%ADndice+postgres');
  });

  it('manda a janela temporal e o limite quando pedidos', async () => {
    const { calls, impl } = stubFetch();
    await createHttpSource('https://x.dev', impl).list({
      locale: 'pt',
      before: '2025-01-01T00:00:00.000Z',
      limit: 20,
    });
    expect(calls[0]).toContain('before=2025-01-01T00%3A00%3A00.000Z');
    expect(calls[0]).toContain('limit=20');
  });

  it('traduz published_at para o formato do domínio', async () => {
    const { impl } = stubFetch({ body: { data: [SUMMARY_ROW] } });
    const [item] = await createHttpSource('https://x.dev', impl).list({ locale: 'pt' });
    expect(item).toEqual({
      slug: 'code-review-sem-atrito',
      publishedAt: '2025-09-12T12:00:00.000Z',
      category: 'rotina',
      featured: false,
      title: 'Code review sem atrito',
      summary: 'Comentar o código, não a pessoa.',
    });
  });

  it('uma falha da API é uma falha, não uma lista vazia', async () => {
    const { impl } = stubFetch({ status: 500 });
    await expect(createHttpSource('https://x.dev', impl).list({ locale: 'pt' })).rejects.toThrow();
  });

  /** Uma API que respondeu, mas declarou ter cortado o acervo. */
  const truncatedFetch = (() =>
    Promise.resolve(
      new Response(JSON.stringify({ data: [], meta: { count: 2, limit: 2, truncated: true } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )) as unknown as typeof fetch;

  it('lanca quando a API diz que truncou, para o build nao publicar meio acervo', async () => {
    const source = createHttpSource('http://api', truncatedFetch);

    await expect(source.list({ locale: 'pt' })).rejects.toThrow(/truncad/i);
  });

  it('avisa em vez de lancar quando quem chama oferece onTruncated', async () => {
    const avisos: { count: number; limit: number }[] = [];
    const source = createHttpSource('http://api', truncatedFetch, {
      onTruncated: (meta) => avisos.push(meta),
    });

    await expect(source.list({ locale: 'pt' })).resolves.toEqual([]);
    expect(avisos).toEqual([{ count: 2, limit: 2 }]);
  });
});

describe('createHttpSource — a publicação', () => {
  it('pede o slug e o idioma', async () => {
    const { calls, impl } = stubFetch({ body: { data: { ...SUMMARY_ROW, body: 'um' } } });
    await createHttpSource('https://x.dev', impl).get('code-review-sem-atrito', 'pt');
    expect(calls[0]).toBe('https://x.dev/api/publications/code-review-sem-atrito?locale=pt');
  });

  it('escapa o slug no caminho', async () => {
    const { calls, impl } = stubFetch({ body: { data: { ...SUMMARY_ROW, body: '' } } });
    await createHttpSource('https://x.dev', impl).get('a/b?c', 'pt');
    expect(calls[0]).toContain('/api/publications/a%2Fb%3Fc?locale=pt');
  });

  it('entrega o corpo como a string de Markdown crua, sem dividir', async () => {
    const { impl } = stubFetch({
      body: { data: { ...SUMMARY_ROW, body: 'primeiro\n\nsegundo' } },
    });
    const detail = await createHttpSource('https://x.dev', impl).get('x', 'pt');
    expect(detail?.body).toBe('primeiro\n\nsegundo');
  });

  it('404 é ausência, não erro', async () => {
    const { impl } = stubFetch({ status: 404 });
    await expect(createHttpSource('https://x.dev', impl).get('sumiu', 'pt')).resolves.toBeNull();
  });

  it('500 continua sendo erro', async () => {
    const { impl } = stubFetch({ status: 500 });
    await expect(createHttpSource('https://x.dev', impl).get('x', 'pt')).rejects.toThrow();
  });
});

describe('createHttpSource — isenção de throttle do prerender', () => {
  function stubFetchWithHeaders(reply: { body?: unknown } = {}) {
    const headerValues: (string | null)[] = [];
    const impl = (_input: string, init?: RequestInit): Promise<Response> => {
      headerValues.push(new Headers(init?.headers).get('X-Internal-Token'));
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(reply.body ?? { data: [] }),
      } as Response);
    };
    return { headerValues, impl: impl as unknown as typeof fetch };
  }

  it('sem token, não manda o cabeçalho', async () => {
    const { headerValues, impl } = stubFetchWithHeaders();
    await createHttpSource('https://x.dev', impl).list({ locale: 'pt' });
    expect(headerValues[0]).toBeNull();
  });

  it('com token, manda o mesmo valor no cabeçalho na lista', async () => {
    const { headerValues, impl } = stubFetchWithHeaders({ body: { data: [] } });
    const source = createHttpSource('https://x.dev', impl, { internalToken: 'segredo-123' });

    await source.list({ locale: 'pt' });

    expect(headerValues).toEqual(['segredo-123']);
  });

  it('com token, manda o mesmo valor no cabeçalho na publicação', async () => {
    const { headerValues, impl } = stubFetchWithHeaders({
      body: { data: { ...SUMMARY_ROW, body: 'x' } },
    });
    const source = createHttpSource('https://x.dev', impl, { internalToken: 'segredo-123' });

    await source.get('code-review-sem-atrito', 'pt');

    expect(headerValues).toEqual(['segredo-123']);
  });
});

/**
 * Um servidor de mentira que fala exatamente o que o Laravel vai falar.
 *
 * Serve o acervo semente pelo adapter estático, traduzindo a ida e a volta para
 * a forma da API — query string na entrada, `snake_case` dentro de `data` na
 * saída. É o que permite rodar a suíte de contrato contra o adapter HTTP: se o
 * mapeamento errar em qualquer ponto, a mesma bateria que o estático passa
 * quebra aqui.
 */
function apiFetch(): typeof fetch {
  const backing = createStaticSource(PUBLICATIONS);

  const toRow = (item: PublicationSummary) => ({
    slug: item.slug,
    category: item.category,
    published_at: item.publishedAt,
    featured: item.featured === true,
    title: item.title,
    summary: item.summary,
  });

  const reply = (status: number, body: unknown): Response =>
    ({ ok: status < 300, status, json: () => Promise.resolve(body) }) as Response;

  return (async (input: string) => {
    const url = new URL(input);
    const locale = url.searchParams.get('locale') === 'en' ? 'en' : 'pt';
    const detail = /\/api\/publications\/(.+)$/.exec(url.pathname);

    if (detail?.[1] !== undefined) {
      const found = await backing.get(decodeURIComponent(detail[1]), locale);
      if (found === null) return reply(404, { message: 'Not Found' });
      const { body, ...summary } = found;
      return reply(200, { data: { ...toRow(summary), body } });
    }

    const limit = url.searchParams.get('limit');
    const items = await backing.list({
      locale,
      ...(url.searchParams.get('category') === null
        ? {}
        : { category: url.searchParams.get('category') as 'artigo' }),
      ...(url.searchParams.get('q') === null ? {} : { q: url.searchParams.get('q') ?? '' }),
      ...(url.searchParams.get('before') === null
        ? {}
        : { before: url.searchParams.get('before') ?? '' }),
      ...(limit === null ? {} : { limit: Number(limit) }),
    });
    return reply(200, { data: items.map(toRow) });
  }) as unknown as typeof fetch;
}

describePublicationsSource('createHttpSource', () =>
  createHttpSource('https://api.rdmlabs.dev', apiFetch()),
);

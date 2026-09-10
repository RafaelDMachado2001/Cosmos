import { describe, expect, it } from 'vitest';

import { createStaticSource } from './PublicationsSource';
import type { PublicationsSource } from './PublicationsSource';
import { PUBLICATIONS } from './publications';

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
        expect(pt?.body[0]).not.toBe(en?.body[0]);
      });

      it('devolve null para slug desconhecido, em vez de lançar', async () => {
        expect(await source.get('slug-que-nao-existe', 'pt')).toBeNull();
      });
    });
  });
}

describePublicationsSource('createStaticSource', () => createStaticSource(PUBLICATIONS));

import { describe, expect, it } from 'vitest';

import {
  draftKey,
  isOwnComment,
  parseComment,
  parseCommentsPage,
  parseReaction,
  relativeTime,
  shareLinks,
  toggleReaction,
} from './community';

const NOW = Date.parse('2026-11-09T12:00:00Z');

describe('parseCommentsPage', () => {
  it('lê itens, cursor e total, e descarta item fora do formato', () => {
    const page = parseCommentsPage({
      data: [
        { id: 1, body: 'Oi', createdAt: '2026-11-01T10:00:00Z', author: { name: 'Ana', handle: 'ana', avatarUrl: null } },
        { id: 'x', body: 'quebrado' },
        { id: 2, body: 'Sem autor', createdAt: '2026-11-01T11:00:00Z', author: null },
      ],
      meta: { count: 2, next: 2, total: 31 },
    });
    expect(page.items.map((item) => item.id)).toEqual([1, 2]);
    expect(page.items[1]?.author).toBeNull();
    expect(page.next).toBe(2);
    expect(page.total).toBe(31);
  });

  it('sem total cai no tamanho da página; resposta vazia é lista vazia', () => {
    expect(parseCommentsPage({ data: [], meta: { next: null } })).toEqual({ items: [], next: null, total: 0 });
    expect(parseCommentsPage(null)).toEqual({ items: [], next: null, total: 0 });
  });

  it('o comentário isolado, como volta do POST', () => {
    expect(parseComment({ id: 3, body: 'b', createdAt: 'x', author: { name: '', handle: 'h' } })?.author)
      .toEqual({ name: '', handle: 'h', avatarUrl: null });
  });
});

describe('reação', () => {
  it('lê o estado, sem reacted é falso', () => {
    expect(parseReaction({ data: { count: 4 } })).toEqual({ count: 4, reacted: false });
    expect(parseReaction({ data: { count: 5, reacted: true } })).toEqual({ count: 5, reacted: true });
  });

  it('alternar soma ou tira um, nunca abaixo de zero', () => {
    expect(toggleReaction({ count: 12, reacted: false })).toEqual({ count: 13, reacted: true });
    expect(toggleReaction({ count: 13, reacted: true })).toEqual({ count: 12, reacted: false });
    expect(toggleReaction({ count: 0, reacted: true })).toEqual({ count: 0, reacted: false });
  });
});

describe('isOwnComment', () => {
  const comment = { id: 1, body: '', createdAt: '', author: { name: '', handle: 'ana', avatarUrl: null } };
  it('compara pelo handle de quem está logado', () => {
    expect(isOwnComment(comment, 'ana')).toBe(true);
    expect(isOwnComment(comment, 'bia')).toBe(false);
    expect(isOwnComment(comment, null)).toBe(false);
    expect(isOwnComment({ ...comment, author: null }, 'ana')).toBe(false);
  });
});

describe('relativeTime', () => {
  const ago = (ms: number) => new Date(NOW - ms).toISOString();
  it('agora, minutos, horas, ontem, dias e depois a data', () => {
    expect(relativeTime(ago(10_000), NOW)).toEqual({ kind: 'now' });
    expect(relativeTime(ago(5 * 60_000), NOW)).toEqual({ kind: 'minutes', n: 5 });
    expect(relativeTime(ago(3 * 3_600_000), NOW)).toEqual({ kind: 'hours', n: 3 });
    expect(relativeTime(ago(30 * 3_600_000), NOW)).toEqual({ kind: 'yesterday' });
    expect(relativeTime(ago(4 * 86_400_000), NOW)).toEqual({ kind: 'days', n: 4 });
    expect(relativeTime(ago(40 * 86_400_000), NOW)).toEqual({ kind: 'date' });
  });

  it('relógio adiantado no servidor não vira tempo negativo', () => {
    expect(relativeTime(new Date(NOW + 60_000).toISOString(), NOW)).toEqual({ kind: 'now' });
  });
});

describe('shareLinks', () => {
  it('codifica a URL e o título em cada destino', () => {
    const [linkedin, x, email] = shareLinks('https://c.dev/pt/publicacoes/a b', 'Café & código');
    expect(linkedin?.href).toBe(
      'https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fc.dev%2Fpt%2Fpublicacoes%2Fa%20b',
    );
    expect(x?.href).toContain('&text=Caf%C3%A9%20%26%20c%C3%B3digo');
    expect(email?.href).toBe('mailto:?subject=Caf%C3%A9%20%26%20c%C3%B3digo&body=https%3A%2F%2Fc.dev%2Fpt%2Fpublicacoes%2Fa%20b');
  });
});

describe('draftKey', () => {
  it('separa por idioma e publicação', () => {
    expect(draftKey('cafe', 'pt')).not.toBe(draftKey('cafe', 'en'));
  });
});

import { describe, expect, it } from 'vitest';

import { ANONYMOUS, loginHref, loginOutcome, parseMember, sessionOf, xsrfToken } from './session';

const api = {
  data: {
    id: 7,
    name: 'Ana',
    handle: 'ana',
    avatarUrl: 'https://lh3.example/ana.jpg',
    email: 'ana@example.com',
    locale: 'en',
    providers: ['google', 'facebook'],
    createdAt: '2026-10-19T12:00:00+00:00',
  },
};

describe('parseMember', () => {
  it('le o perfil da API e descarta provedor desconhecido', () => {
    expect(parseMember(api)).toEqual({
      id: 7,
      name: 'Ana',
      handle: 'ana',
      avatarUrl: 'https://lh3.example/ana.jpg',
      email: 'ana@example.com',
      locale: 'en',
      providers: ['google'],
    });
  });

  it('recusa o que nao tem o formato', () => {
    expect(parseMember(null)).toBeNull();
    expect(parseMember({ data: { ...api.data, id: '7' } })).toBeNull();
    expect(parseMember({ data: { ...api.data, locale: 'fr' } })).toBeNull();
  });

  it('avatar e email ausentes viram null', () => {
    expect(parseMember({ data: { ...api.data, avatarUrl: null, email: undefined } })).toMatchObject({
      avatarUrl: null,
      email: null,
    });
  });
});

describe('sessionOf', () => {
  it('sem membro e anonimo, com membro e member', () => {
    expect(sessionOf(null)).toBe(ANONYMOUS);
    const member = parseMember(api);
    expect(member).not.toBeNull();
    if (member !== null) expect(sessionOf(member)).toEqual({ kind: 'member', member });
  });
});

describe('loginHref', () => {
  it('leva o caminho de volta codificado', () => {
    expect(loginHref('https://api.rdmlabs.com.br/', 'github', '/en/publications/x?y=1')).toBe(
      'https://api.rdmlabs.com.br/auth/github/redirect?return=%2Fen%2Fpublications%2Fx%3Fy%3D1',
    );
  });

  it('na mesma origem, o caminho fica relativo', () => {
    expect(loginHref('/', 'google', '/pt')).toBe('/auth/google/redirect?return=%2Fpt');
  });
});

describe('loginOutcome', () => {
  it('le o motivo que a API acrescenta', () => {
    expect(loginOutcome('?login=unverified')).toBe('unverified');
    expect(loginOutcome('?a=1&login=failed')).toBe('failed');
  });

  it('ignora o resto', () => {
    expect(loginOutcome('')).toBeNull();
    expect(loginOutcome('?login=<script>')).toBeNull();
  });
});

describe('xsrfToken', () => {
  it('acha e decodifica o cookie', () => {
    expect(xsrfToken('a=1; XSRF-TOKEN=eyJ%3D%3D; b=2')).toBe('eyJ==');
  });

  it('sem o cookie, ou com valor quebrado, e null', () => {
    expect(xsrfToken('a=1')).toBeNull();
    expect(xsrfToken('XSRF-TOKEN=%E0%A4%A')).toBeNull();
  });
});

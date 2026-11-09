import { describe, expect, it } from 'vitest';

import {
  ANONYMOUS,
  confirmsHandle,
  displayName,
  initials,
  loginHref,
  loginOutcome,
  maskEmail,
  parseMember,
  sessionOf,
  withoutLoginOutcome,
  xsrfToken,
} from './session';

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
  it('lê o perfil da API e descarta provedor desconhecido', () => {
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

  it('recusa o que não tem o formato', () => {
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
  it('sem membro e anônimo, com membro e member', () => {
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
  it('lê o motivo que a API acrescenta', () => {
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

  it('sem o cookie, ou com valor quebrado, é null', () => {
    expect(xsrfToken('a=1')).toBeNull();
    expect(xsrfToken('XSRF-TOKEN=%E0%A4%A')).toBeNull();
  });
});

describe('withoutLoginOutcome', () => {
  it('tira só o login da busca', () => {
    expect(withoutLoginOutcome('?login=failed')).toBe('');
    expect(withoutLoginOutcome('?q=cafe&login=unverified')).toBe('?q=cafe');
    expect(withoutLoginOutcome('')).toBe('');
  });
});

describe('initials', () => {
  it('usa as duas primeiras palavras do nome', () => {
    expect(initials('Ana Ribeiro Costa', 'anarib')).toBe('AR');
  });

  it('cai no handle quando o nome está vazio, separando por _', () => {
    expect(initials('', 'lucas_dev')).toBe('LD');
    expect(initials('   ', 'mcosta')).toBe('M');
  });

  it('não parte um caractere fora do plano básico', () => {
    expect(initials('𝓐na', 'x')).toBe('𝓐');
  });
});

describe('displayName', () => {
  it('é o nome, ou o @handle sem nome', () => {
    expect(displayName({ name: 'Ana', handle: 'ana' })).toBe('Ana');
    expect(displayName({ name: '', handle: 'ana' })).toBe('@ana');
  });
});

describe('maskEmail', () => {
  it('mostra só a primeira letra e o domínio', () => {
    expect(maskEmail('camila@gmail.com')).toBe('c•••••@gmail.com');
  });

  it('devolve intacto o que não parece e-mail', () => {
    expect(maskEmail('sem-arroba')).toBe('sem-arroba');
  });
});

describe('confirmsHandle', () => {
  it('aceita com ou sem @, com espaço nas pontas', () => {
    expect(confirmsHandle('@camila_r', 'camila_r')).toBe(true);
    expect(confirmsHandle(' camila_r ', 'camila_r')).toBe(true);
  });

  it('recusa qualquer diferença, inclusive de caixa', () => {
    expect(confirmsHandle('@Camila_r', 'camila_r')).toBe(false);
    expect(confirmsHandle('@camila', 'camila_r')).toBe(false);
    expect(confirmsHandle('', 'camila_r')).toBe(false);
  });
});

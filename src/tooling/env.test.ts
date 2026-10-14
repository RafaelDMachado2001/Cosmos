import { describe, expect, it } from 'vitest';

import { compareKeys, parseEnv, productionProblems } from './env';

describe('parseEnv', () => {
  it('le chave e valor, ignora comentario e linha vazia, tira aspas', () => {
    const text = `# comentario
APP_ENV=production

APP_NAME="RDM Labs"
EMPTY=
QUOTED='x'`;
    expect(parseEnv(text)).toEqual({
      APP_ENV: 'production',
      APP_NAME: 'RDM Labs',
      EMPTY: '',
      QUOTED: 'x',
    });
  });
});

describe('compareKeys', () => {
  it('aponta o que falta e o que sobra em relacao ao exemplo', () => {
    expect(compareKeys({ A: '', B: '' }, { B: '1', C: '2' }, '.env')).toEqual([
      '.env: falta A (está no .env.example)',
      '.env: sobra C (não está no .env.example)',
    ]);
  });

  it('nada a dizer quando as chaves coincidem, com qualquer valor', () => {
    expect(compareKeys({ A: '' }, { A: 'qualquer' }, '.env')).toEqual([]);
  });
});

describe('productionProblems', () => {
  const ok = {
    root: { VITE_SITE_URL: 'https://rdmlabs.dev' },
    backend: {
      APP_ENV: 'production',
      APP_DEBUG: 'false',
      APP_KEY: 'base64:abc',
      DB_PASSWORD: 'segredo',
    },
  };

  it('fora de producao, nada e exigido', () => {
    expect(productionProblems({ root: {}, backend: { APP_ENV: 'local', APP_DEBUG: 'true' } })).toEqual(
      [],
    );
  });

  it('uma producao bem configurada passa', () => {
    expect(productionProblems(ok)).toEqual([]);
  });

  it('em producao: debug desligado, chave, senha de banco e URL absoluta', () => {
    expect(
      productionProblems({
        root: { VITE_SITE_URL: 'localhost:8080' },
        backend: { APP_ENV: 'production', APP_DEBUG: 'true', APP_KEY: '', DB_PASSWORD: '' },
      }),
    ).toEqual([
      'APP_DEBUG precisa ser false em produção',
      'APP_KEY vazia em produção',
      'DB_PASSWORD vazia em produção',
      'VITE_SITE_URL precisa ser absoluta (http:// ou https://): "localhost:8080"',
    ]);
  });
});

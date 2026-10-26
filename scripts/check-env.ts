import { existsSync, readFileSync } from 'node:fs';

import { compareKeys, parseEnv, productionProblems } from '../src/tooling/env';
import type { Env } from '../src/tooling/env';

/*
 * Roda no predev, no prebuild e no CI. Sem .env — o build da imagem, que o
 * exclui pelo .dockerignore, e o CI, que não tem segredo nenhum — não há o que
 * comparar, e isso não é erro.
 */

function read(path: string): Env | null {
  return existsSync(path) ? parseEnv(readFileSync(path, 'utf8')) : null;
}

const problems: string[] = [];

for (const dir of ['.', 'backend']) {
  const example = read(`${dir}/.env.example`);
  const actual = read(`${dir}/.env`);
  if (example === null || actual === null) continue;
  problems.push(...compareKeys(example, actual, `${dir}/.env`));
}

problems.push(
  ...productionProblems({ root: read('.env') ?? {}, backend: read('backend/.env') ?? {} }),
);

if (problems.length > 0) {
  console.error(`Ambiente inválido:\n${problems.map((problem) => `  - ${problem}`).join('\n')}`);
  process.exit(1);
}
console.log('ambiente: ok');

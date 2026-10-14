/**
 * Validação dos arquivos de ambiente, sem tocar em disco.
 *
 * `scripts/check-env.ts` lê os arquivos e decide o código de saída; aqui fica só
 * o julgamento, para ele ter teste. Roda no `predev`, no `prebuild` e no CI.
 */

export type Env = Readonly<Record<string, string>>;

export function parseEnv(text: string): Env {
  const env: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const [, key, raw] = match;
    if (key === undefined || raw === undefined) continue;
    env[key] = raw.trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  return env;
}

/**
 * Chave faltando quebra em silêncio — o código lê `undefined` e segue com o
 * padrão. Chave sobrando é quase sempre um nome digitado errado, que é a mesma
 * coisa vista do outro lado.
 */
export function compareKeys(example: Env, actual: Env, label: string): readonly string[] {
  const missing = Object.keys(example)
    .filter((key) => !(key in actual))
    .map((key) => `${label}: falta ${key} (está no .env.example)`);
  const extra = Object.keys(actual)
    .filter((key) => !(key in example))
    .map((key) => `${label}: sobra ${key} (não está no .env.example)`);
  return [...missing, ...extra];
}

/**
 * O que não pode ir ao ar. Produção é o `APP_ENV` do backend dizendo que é —
 * fora dela, debug ligado e senha vazia são o normal do desenvolvimento.
 */
export function productionProblems({ root, backend }: { root: Env; backend: Env }): readonly string[] {
  if (backend.APP_ENV !== 'production') return [];

  const problems: string[] = [];
  if (backend.APP_DEBUG !== 'false') problems.push('APP_DEBUG precisa ser false em produção');
  if (!backend.APP_KEY) problems.push('APP_KEY vazia em produção');
  if (!backend.DB_PASSWORD) problems.push('DB_PASSWORD vazia em produção');

  // Canonical, hreflang, sitemap e og:image saem dela: relativa, todos mentem.
  const site = root.VITE_SITE_URL ?? '';
  if (!/^https?:\/\/[^/\s]+/.test(site)) {
    problems.push(`VITE_SITE_URL precisa ser absoluta (http:// ou https://): "${site}"`);
  }
  return problems;
}

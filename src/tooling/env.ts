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

export function compareKeys(example: Env, actual: Env, label: string): readonly string[] {
  const missing = Object.keys(example)
    .filter((key) => !(key in actual))
    .map((key) => `${label}: falta ${key} (está no .env.example)`);
  const extra = Object.keys(actual)
    .filter((key) => !(key in example))
    .map((key) => `${label}: sobra ${key} (não está no .env.example)`);
  return [...missing, ...extra];
}

export function productionProblems({ root, backend }: { root: Env; backend: Env }): readonly string[] {
  if (backend.APP_ENV !== 'production') return [];

  const problems: string[] = [];
  if (backend.APP_DEBUG !== 'false') problems.push('APP_DEBUG precisa ser false em produção');
  if (!backend.APP_KEY) problems.push('APP_KEY vazia em produção');
  if (!backend.DB_PASSWORD) problems.push('DB_PASSWORD vazia em produção');

  const site = root.VITE_SITE_URL ?? '';
  if (!/^https?:\/\/[^/\s]+/.test(site)) {
    problems.push(`VITE_SITE_URL precisa ser absoluta (http:// ou https://): "${site}"`);
  }
  return problems;
}

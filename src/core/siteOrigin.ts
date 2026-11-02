export const LOCAL_ORIGIN = 'http://localhost:5174';

export function resolveSiteOrigin(env: Readonly<Record<string, string | undefined>>): string {
  const explicit = env.VITE_SITE_URL;
  if (explicit !== undefined && explicit !== '') return explicit.replace(/\/+$/, '');

  const vercelEnv = vercel(env, 'VERCEL_ENV');
  if (vercelEnv === 'production') {
    const domain = vercel(env, 'VERCEL_PROJECT_PRODUCTION_URL');
    if (domain === null) {
      throw new Error(
        'Build de produção sem origem: defina VITE_SITE_URL ou exponha as variáveis de sistema da Vercel.',
      );
    }
    return `https://${domain}`;
  }
  const previewUrl = vercel(env, 'VERCEL_URL');
  if (vercelEnv === 'preview' && previewUrl !== null) return `https://${previewUrl}`;

  return LOCAL_ORIGIN;
}

function vercel(env: Readonly<Record<string, string | undefined>>, name: string): string | null {
  const value = env[`VITE_${name}`] ?? env[name];
  return value === undefined || value === '' ? null : value;
}

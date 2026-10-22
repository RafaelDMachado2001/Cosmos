/** A origem do desenvolvimento local, o padrão fora da Vercel. */
export const LOCAL_ORIGIN = 'http://localhost:5174';

/**
 * A origem absoluta do site, para canonical, `og:url`, `og:image`, sitemap,
 * robots e RSS — tudo o que outro site lê sem o contexto da página.
 *
 * `VITE_SITE_URL` vence sempre. Sem ela, na Vercel, vale o que a plataforma
 * expõe ao build: o domínio de produção do projeto, ou o endereço do preview —
 * com o prefixo `VITE_` que ela acrescenta para o Vite ou sem ele.
 * O build de produção sem nenhuma das duas falha: antes ele caía em
 * `localhost` calado, e o site inteiro foi ao ar com canonical, sitemap e
 * cards de compartilhamento apontando para a máquina de quem lê.
 */
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

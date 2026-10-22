/**
 * O host do site público, para as prévias de SEO e do card no Studio.
 *
 * Em produção o painel mora em `admin.` e o site em outro host, então a origem
 * vem do servidor (`SITE_URL`) num `<meta>`. Sem ela, como no docker compose,
 * em que painel e site dividem o host, vale o da própria página.
 */
export function siteHost(siteUrl: string | null, fallback: string): string {
  try {
    return new URL(siteUrl ?? '').host;
  } catch {
    return fallback;
  }
}

/**
 * A origem do site público, para o link que o Studio compartilha. Mesma regra
 * de `siteHost`: a do servidor quando há, senão a da própria página.
 */
export function siteOrigin(siteUrl: string | null, fallback: string): string {
  try {
    return new URL(siteUrl ?? '').origin;
  } catch {
    return fallback;
  }
}

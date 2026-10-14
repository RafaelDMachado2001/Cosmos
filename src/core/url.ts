/**
 * Junta origem e caminho sem duplicar a barra.
 *
 * `VITE_SITE_URL` vem do `.env` e a barra final depende de quem digitou. Duas
 * barras aqui não quebram o site, mas geram um canonical diferente do endereço
 * real — que é exatamente o que o canonical existe para evitar.
 *
 * Módulo puro: o cabeçalho de SEO e o sitemap precisam concordar byte a byte.
 */
export function absolute(origin: string, path: string): string {
  return `${origin.replace(/\/+$/, '')}${path}`;
}

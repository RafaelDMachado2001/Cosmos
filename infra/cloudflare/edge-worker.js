/**
 * A borda de api.rdmlabs.com.br e admin.rdmlabs.com.br.
 *
 * O mapeamento de domínio do Cloud Run não existe em southamerica-east1, então
 * a Cloudflare recebe os dois hosts e este Worker repassa à URL *.run.app do
 * serviço. O host que o navegador pediu vai em X-Forwarded-Host — o Laravel
 * decide painel ou API e o cookie de sessão por ele (HostBoundary) —, e o
 * segredo em X-Edge-Secret prova que a requisição passou por aqui
 * (VerifyEdge). O X-Forwarded-For é sobrescrito com o IP que a Cloudflare viu:
 * o que o cliente mandar nele não pode furar o throttle.
 *
 * Variáveis (Terraform, infra/cloudflare.tf): ORIGIN e EDGE_SECRET.
 */

/**
 * @param {Request} request
 * @param {{ ORIGIN: string, EDGE_SECRET: string }} env
 * @returns {Request}
 */
export function forward(request, env) {
  const incoming = new URL(request.url);
  const target = new URL(incoming.pathname + incoming.search, env.ORIGIN);

  const headers = new Headers(request.headers);
  headers.set('X-Forwarded-Host', incoming.hostname);
  headers.set('X-Forwarded-Proto', 'https');
  headers.set('X-Edge-Secret', env.EDGE_SECRET);
  const client = request.headers.get('CF-Connecting-IP');
  if (client === null) headers.delete('X-Forwarded-For');
  else headers.set('X-Forwarded-For', client);

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  return new Request(target, {
    method: request.method,
    headers,
    body: hasBody ? request.body : null,
    // O padrão do Fetch para corpo em stream; quem não conhece, ignora.
    ...(hasBody ? { duplex: 'half' } : {}),
    // O 302 do login e o 301 de canonical são do navegador, não do Worker.
    redirect: 'manual',
  });
}

export default {
  /**
   * @param {Request} request
   * @param {{ ORIGIN: string, EDGE_SECRET: string }} env
   */
  fetch(request, env) {
    return fetch(forward(request, env));
  },
};

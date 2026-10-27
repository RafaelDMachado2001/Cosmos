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
 * É também a primeira defesa contra bots. Cada requisição que chega ao Cloud
 * Run pode acordar uma instância e o Neon, então o que dá para responder aqui
 * não segue: caminhos que nenhum host atende (as varreduras de /wp-admin,
 * /.env...) morrem em 404, o robots.txt sai daqui, e a leitura pública da API
 * fica em cache por um minuto.
 *
 * Variáveis (Terraform, infra/cloudflare.tf): ORIGIN e EDGE_SECRET.
 */

/** O que cada host atende; o resto não chega ao Cloud Run. */
const ROUTES = {
  api: /^\/(?:(?:api|auth)\/|up$)/,
  admin: /^\/(?:admin(?:\/|$)|livewire(?:-[0-9a-f]+)?\/|filament\/|(?:css|js|fonts)\/filament\/|favicon\.ico$|up$)/,
};

/** A leitura pública: igual para todo mundo, então pode ficar na borda. */
const CACHEABLE = /^\/api\/publications(?:\/|$)/;

/** Segundos em cache. Curto o bastante para uma edição aparecer logo. */
export const CACHE_TTL = 60;

const ROBOTS = 'User-agent: *\nDisallow: /\n';

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

/** O host atende este caminho? `api.x` e `admin.x`, pelo primeiro rótulo. */
export function routed(url) {
  const route = ROUTES[url.hostname.split('.')[0]];
  return route !== undefined && route.test(url.pathname);
}

/**
 * A leitura pública vai sem cookie, Origin e Referer: sem eles o Sanctum não
 * abre sessão e a resposta não traz Set-Cookie, então é a mesma para todos.
 * O CORS dela é `*` (PublicCors), que não depende da origem.
 */
function anonymous(request) {
  const headers = new Headers(request.headers);
  for (const name of ['Cookie', 'Origin', 'Referer', 'Authorization']) headers.delete(name);
  return new Request(request.url, { method: 'GET', headers });
}

/**
 * @param {Request} request
 * @param {{ ORIGIN: string, EDGE_SECRET: string }} env
 * @param {{ waitUntil(promise: Promise<unknown>): void }} ctx
 * @param {{ cache: { match(key: Request): Promise<Response | undefined>, put(key: Request, response: Response): Promise<void> }, fetch: typeof fetch }} deps
 */
export async function handle(request, env, ctx, deps) {
  const url = new URL(request.url);

  if (url.pathname === '/robots.txt') {
    return new Response(ROBOTS, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=86400' },
    });
  }

  if (!routed(url)) {
    return new Response('Not Found', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Robots-Tag': 'noindex' },
    });
  }

  if (request.method !== 'GET' || !CACHEABLE.test(url.pathname)) {
    return deps.fetch(forward(request, env));
  }

  const key = new Request(url.toString(), { method: 'GET' });
  // O build da Vercel manda o token interno e lê sempre da origem: publicar
  // e ver o site regenerado com o texto de um minuto atrás seria pior que
  // não ter cache. A resposta dele renova o cache para os outros.
  const internal = request.headers.has('X-Internal-Token');
  if (!internal) {
    const hit = await deps.cache.match(key);
    if (hit !== undefined) {
      const response = new Response(hit.body, hit);
      response.headers.set('X-Edge-Cache', 'HIT');
      return response;
    }
  }

  const origin = await deps.fetch(forward(anonymous(request), env));
  const response = new Response(origin.body, origin);
  // Uma resposta com sessão nunca vai para o cache: seria a sessão de alguém
  // entregue a todo mundo.
  if (origin.status === 200 && !origin.headers.has('Set-Cookie')) {
    response.headers.set('Cache-Control', `public, max-age=${String(CACHE_TTL)}`);
    ctx.waitUntil(deps.cache.put(key, response.clone()));
  }
  response.headers.set('X-Edge-Cache', 'MISS');
  // Um 503 do próprio Cloud Run (instância que não subiu a tempo) nunca passou
  // pelo PublicCors do Laravel, e sem o cabeçalho o navegador só vê "Failed to
  // fetch". A leitura pública é `*` em qualquer status.
  if (!response.headers.has('Access-Control-Allow-Origin')) {
    response.headers.set('Access-Control-Allow-Origin', '*');
  }
  return response;
}

export default {
  /**
   * @param {Request} request
   * @param {{ ORIGIN: string, EDGE_SECRET: string }} env
   * @param {{ waitUntil(promise: Promise<unknown>): void }} ctx
   */
  fetch(request, env, ctx) {
    // `caches.default` é o cache da Cloudflare no datacenter que atendeu.
    // O `fetch` vai embrulhado: chamado como `deps.fetch(...)`, o `this` dele
    // vira o objeto, e o runtime da Cloudflare lança "Illegal invocation"
    // (erro 1101 em toda requisição, visto em produção).
    return handle(request, env, ctx, { cache: caches.default, fetch: (input) => fetch(input) });
  },
};

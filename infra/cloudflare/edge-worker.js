const ROUTES = {
  api: /^\/(?:(?:api|auth)\/|up$)/,
  admin: /^\/(?:admin(?:\/|$)|livewire(?:-[0-9a-f]+)?\/|filament\/|(?:css|js|fonts)\/filament\/|favicon\.ico$|up$)/,
};

const CACHEABLE = /^\/api\/publications(?:\/|$)/;

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
    ...(hasBody ? { duplex: 'half' } : {}),
    redirect: 'manual',
  });
}

export function routed(url) {
  const route = ROUTES[url.hostname.split('.')[0]];
  return route !== undefined && route.test(url.pathname);
}

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
  if (origin.status === 200 && !origin.headers.has('Set-Cookie')) {
    response.headers.set('Cache-Control', `public, max-age=${String(CACHE_TTL)}`);
    ctx.waitUntil(deps.cache.put(key, response.clone()));
  }
  response.headers.set('X-Edge-Cache', 'MISS');
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
    return handle(request, env, ctx, { cache: caches.default, fetch: (input) => fetch(input) });
  },
};

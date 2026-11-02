type Env = Record<string, string | undefined>;

export function distDir(env: Env): string {
  const configured = env.DIST;
  return configured === undefined || configured === '' ? 'dist' : configured;
}

export function templateDir(env: Env): string {
  const configured = env.TEMPLATE_DIR;
  return configured === undefined || configured === '' ? distDir(env) : configured;
}

export function apiUrlFrom(env: Env): string | null {
  const configured = env.PRERENDER_API_URL ?? env.VITE_API_URL;
  if (configured === undefined || configured === '' || configured === '/') return null;
  return configured.replace(/\/+$/, '');
}

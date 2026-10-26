/**
 * De onde o prerender lê e onde ele grava.
 *
 * Eram constantes: `DIST` em `main.ts` e a URL da API congelada no bundle por
 * `vite.prerender.config.ts`. O job da fase 9 roda o mesmo prerender apontado
 * para outro diretório e para outro endereço, então os dois passam a vir do
 * ambiente. Puras e separadas para serem testaveis sem mexer em `process.env`.
 */

type Env = Record<string, string | undefined>;

export function distDir(env: Env): string {
  const configured = env.DIST;
  return configured === undefined || configured === '' ? 'dist' : configured;
}

/**
 * De onde vem o `index.html` que serve de molde.
 *
 * O prerender grava a home composta por cima de `<DIST>/index.html`. No build
 * isso e inofensivo porque o `vite build` reescreve um arquivo intocado antes
 * de cada passada. No job não: sem separar os dois, a segunda publicação leria
 * um molde cujo SLOT já foi preenchido e o prerender morreria. Por padrão segue
 * o DIST, que é exatamente o comportamento de hoje.
 */
export function templateDir(env: Env): string {
  const configured = env.TEMPLATE_DIR;
  return configured === undefined || configured === '' ? distDir(env) : configured;
}

/**
 * Em Node não existe "mesma origem": `/` não tem contra o que resolver, então
 * vale como ausência e o prerender cai no acervo semente.
 */
export function apiUrlFrom(env: Env): string | null {
  const configured = env.PRERENDER_API_URL ?? env.VITE_API_URL;
  if (configured === undefined || configured === '' || configured === '/') return null;
  return configured.replace(/\/+$/, '');
}

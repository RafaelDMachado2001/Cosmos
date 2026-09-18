import { PUBLICATIONS } from './publications';
import { createHttpSource, createStaticSource } from './PublicationsSource';
import type { PublicationsSource } from './PublicationsSource';

/**
 * De onde vêm as publicações.
 *
 * Com `VITE_API_URL` configurada, da API do Laravel; sem ela, do acervo semente
 * em `src/data/publications.ts`. Os dois adapters passam a mesma suíte de
 * contrato, então a constelação não sabe qual está montado — que era
 * exatamente o ponto de a fase 1 ter desenhado `PublicationsSource` antes de
 * existir backend nenhum.
 *
 * O padrão é o estático de propósito: `npm run build` — que inclui o prerender,
 * e portanto roda em Node — continua funcionando sem nada no ar. Quem aponta
 * para a API assume que ela responde também durante o build.
 */
export function createSource(): PublicationsSource {
  return __API_URL__ === null ? createStaticSource(PUBLICATIONS) : createHttpSource(__API_URL__);
}

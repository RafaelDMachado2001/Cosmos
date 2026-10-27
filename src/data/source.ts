import { PUBLICATIONS } from './publications';
import { createHttpSource, createStaticSource } from './PublicationsSource';
import type { PublicationsSource } from './PublicationsSource';
import { createSnapshotLoader } from './snapshotLoader';
import type { SnapshotLoader } from './snapshotLoader';

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
  if (__API_URL__ === null) return createStaticSource(PUBLICATIONS);

  return createHttpSource(__API_URL__, fetch, {
    // Falha de operação, não estado de leitura: a pessoa que lê não tem o que
    // fazer com isso, e apagar a constelação seria pior que mostra-la menor.
    onTruncated: ({ count, limit }) => {
      console.warn(
        `A API truncou o acervo em ${String(limit)} publicacoes, e havia mais; a constelacao mostra so estas ${String(count)}.`,
      );
    },
  });
}

/**
 * O acervo do build, para a constelação abrir sem esperar a API.
 *
 * Só existe com a API: no acervo semente a fonte já é local e nunca falha, e
 * pedir um arquivo a mais seria só uma requisição sem propósito.
 */
export function createSnapshot(): SnapshotLoader | null {
  return __API_URL__ === null ? null : createSnapshotLoader();
}

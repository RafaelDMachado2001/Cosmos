/**
 * Os arquivos com hash que o molde carrega.
 *
 * O job de regeracao compoe paginas a partir de um molde vindo de um build e as
 * grava num destino servido com os assets de outro. Se os dois builds divergirem,
 * cada pagina regravada aponta para scripts que nao existem e o site inteiro fica
 * sem JavaScript — com 200 em tudo, sem erro nenhum no log.
 */
const ASSET_REF = /(?:src|href)="\/(assets\/[^"]+)"/g;

export function assetRefs(html: string): readonly string[] {
  return [...html.matchAll(ASSET_REF)].map((match) => match[1] as string);
}

/** O que o molde pede e o destino nao tem. Vazio e a unica resposta aceitavel. */
export function missingAssets(
  html: string,
  exists: (path: string) => boolean,
): readonly string[] {
  return assetRefs(html).filter((path) => !exists(path));
}

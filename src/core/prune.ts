/**
 * O que sobrou no disco de uma publicação que não existe mais.
 *
 * O job regenera o site inteiro a cada publicação, mas gravar não apaga: um
 * artigo despublicado continuaria servido com 200, que é o soft-404 que a fase
 * 6 eliminou ao tirar o fallback do Nginx.
 *
 * Por diferença, e não esvaziando o destino antes: a regeração completa leva
 * perto de um minuto, e esvaziar deixaria o site fora do ar nessa janela.
 */
export function stalePages(
  existing: readonly string[],
  written: ReadonlySet<string>,
): readonly string[] {
  return existing.filter((path) => !written.has(path));
}

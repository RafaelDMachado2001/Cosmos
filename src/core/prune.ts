/**
 * O que sobrou no disco de uma publicacao que nao existe mais.
 *
 * O job regenera o site inteiro a cada publicacao, mas gravar nao apaga: um
 * artigo despublicado continuaria servido com 200, que e o soft-404 que a fase
 * 6 eliminou ao tirar o fallback do Nginx.
 *
 * Por diferenca, e nao esvaziando o destino antes: a regeracao completa leva
 * perto de um minuto, e esvaziar deixaria o site fora do ar nessa janela.
 */
export function stalePages(
  existing: readonly string[],
  written: ReadonlySet<string>,
): readonly string[] {
  return existing.filter((path) => !written.has(path));
}

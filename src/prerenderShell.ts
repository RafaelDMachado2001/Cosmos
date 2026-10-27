/**
 * A casca pré-renderizada (`#prerender`) depois que o React monta.
 *
 * Ela sai do DOM, não fica só `hidden`: um elemento escondido continua no
 * documento, e o `<h1>` dela somava com o do hero e o do artigo — três H1 na
 * mesma página para quem lê o DOM renderizado, como o Googlebot. Um marcador
 * guarda o lugar para o `ErrorBoundary` devolvê-la se o React quebrar.
 */

let detached: { readonly node: HTMLElement; readonly marker: Comment } | null = null;

/** Tira a casca do documento, guardando onde ela estava. */
export function detachShell(doc: Document = document): void {
  const node = doc.getElementById('prerender');
  if (!node || detached !== null) return;
  const marker = doc.createComment('prerender');
  node.replaceWith(marker);
  detached = { node, marker };
}

/** Devolve a casca ao lugar, visível. */
export function restoreShell(doc: Document = document): void {
  if (detached !== null) {
    detached.marker.replaceWith(detached.node);
    detached = null;
  }
  doc.getElementById('prerender')?.removeAttribute('hidden');
}

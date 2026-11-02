let detached: { readonly node: HTMLElement; readonly marker: Comment } | null = null;

export function detachShell(doc: Document = document): void {
  const node = doc.getElementById('prerender');
  if (!node || detached !== null) return;
  const marker = doc.createComment('prerender');
  node.replaceWith(marker);
  detached = { node, marker };
}

export function restoreShell(doc: Document = document): void {
  if (detached !== null) {
    detached.marker.replaceWith(detached.node);
    detached = null;
  }
  doc.getElementById('prerender')?.removeAttribute('hidden');
}

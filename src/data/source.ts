import { PUBLICATIONS } from './publications';
import { createHttpSource, createStaticSource } from './PublicationsSource';
import type { PublicationsSource } from './PublicationsSource';
import { createSnapshotLoader } from './snapshotLoader';
import type { SnapshotLoader } from './snapshotLoader';

export function createSource(): PublicationsSource {
  if (__API_URL__ === null) return createStaticSource(PUBLICATIONS);

  return createHttpSource(__API_URL__, fetch, {
    onTruncated: ({ count, limit }) => {
      console.warn(
        `A API truncou o acervo em ${String(limit)} publicacoes, e havia mais; a constelacao mostra so estas ${String(count)}.`,
      );
    },
  });
}

export function createSnapshot(): SnapshotLoader | null {
  return __API_URL__ === null ? null : createSnapshotLoader();
}

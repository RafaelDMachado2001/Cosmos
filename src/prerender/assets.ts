const ASSET_REF = /(?:src|href)="\/(assets\/[^"]+)"/g;

export function assetRefs(html: string): readonly string[] {
  return [...html.matchAll(ASSET_REF)].map((match) => match[1] as string);
}

export function missingAssets(
  html: string,
  exists: (path: string) => boolean,
): readonly string[] {
  return assetRefs(html).filter((path) => !exists(path));
}

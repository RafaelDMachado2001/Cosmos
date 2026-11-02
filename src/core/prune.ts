export function stalePages(
  existing: readonly string[],
  written: ReadonlySet<string>,
): readonly string[] {
  return existing.filter((path) => !written.has(path));
}

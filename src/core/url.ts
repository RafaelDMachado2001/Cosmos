export function absolute(origin: string, path: string): string {
  return `${origin.replace(/\/+$/, '')}${path}`;
}

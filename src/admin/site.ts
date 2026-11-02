export function siteHost(siteUrl: string | null, fallback: string): string {
  try {
    return new URL(siteUrl ?? '').host;
  } catch {
    return fallback;
  }
}

export function siteOrigin(siteUrl: string | null, fallback: string): string {
  try {
    return new URL(siteUrl ?? '').origin;
  } catch {
    return fallback;
  }
}

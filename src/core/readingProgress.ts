export function scrollProgress(scrollTop: number, scrollHeight: number, clientHeight: number): number {
  const range = scrollHeight - clientHeight;
  if (range <= 0) return 1;
  return Math.min(1, Math.max(0, scrollTop / range));
}

export const RESUME_MIN = 0.05;
export const RESUME_MAX = 0.97;

export function shouldOfferResume(saved: number | null): boolean {
  return saved !== null && saved > RESUME_MIN && saved < RESUME_MAX;
}

export function progressKey(slug: string): string {
  return `cosmos:progresso:${slug}`;
}

export function parseSavedProgress(raw: string | null): number | null {
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 && value <= 1 ? value : null;
}

export function percentLabel(progress: number): string {
  return `${String(Math.round(progress * 100))}%`;
}

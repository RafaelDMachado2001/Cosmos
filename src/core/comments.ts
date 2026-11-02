export const COMMENT_MAX_LENGTH = 2000;

export function normalizeComment(text: string): string {
  return text.replace(/\r\n?/g, '\n').trim();
}

export function commentLength(text: string): number {
  return [...normalizeComment(text)].length;
}

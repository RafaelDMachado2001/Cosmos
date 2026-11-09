export interface AdminEngagement {
  readonly comments: number;
  readonly reactions: number;
  readonly moderationUrl: string | null;
}

function plural(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}

export function commentsLabel(engagement: AdminEngagement): string {
  return plural(engagement.comments, 'comentário', 'comentários');
}

export function reactionsLabel(engagement: AdminEngagement): string {
  return plural(engagement.reactions, 'reação', 'reações');
}

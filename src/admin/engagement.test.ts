import { describe, expect, it } from 'vitest';

import { commentsLabel, reactionsLabel } from './engagement';

describe('rótulos do engajamento no Studio', () => {
  it('singular só para um', () => {
    const engagement = { comments: 1, reactions: 0, moderationUrl: null };
    expect(commentsLabel(engagement)).toBe('1 comentário');
    expect(reactionsLabel(engagement)).toBe('0 reações');
    expect(commentsLabel({ ...engagement, comments: 12 })).toBe('12 comentários');
    expect(reactionsLabel({ ...engagement, reactions: 1 })).toBe('1 reação');
  });
});

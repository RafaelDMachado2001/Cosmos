import { describe, expect, it } from 'vitest';

import { COMMENT_MAX_LENGTH, commentLength, normalizeComment } from './comments';

describe('comentários', () => {
  it('normaliza quebras de linha e apara como o servidor', () => {
    expect(normalizeComment('  um\r\ndois\rtrês  ')).toBe('um\ndois\ntrês');
  });

  it('conta caracteres como o PHP conta, não unidades UTF-16', () => {
    expect(commentLength('🚀🚀')).toBe(2);
    expect(commentLength('ação')).toBe(4);
    expect(commentLength('a\r\nb')).toBe(3);
  });

  it('o teto é o que a API aceita', () => {
    expect(COMMENT_MAX_LENGTH).toBe(2000);
  });
});

import { describe, expect, it } from 'vitest';

import { absolute } from './url';

describe('absolute', () => {
  it('junta origem e caminho', () => {
    expect(absolute('https://rdmlabs.dev', '/pt')).toBe('https://rdmlabs.dev/pt');
  });

  it('não duplica a barra quando a origem termina em uma ou mais', () => {
    expect(absolute('https://rdmlabs.dev//', '/pt')).toBe('https://rdmlabs.dev/pt');
  });
});

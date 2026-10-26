import { describe, expect, it } from 'vitest';

import { searchForSelected, selectedFromSearch } from './selection';

describe('selectedFromSearch', () => {
  it('lê o id da publicação', () => {
    expect(selectedFromSearch('?publication=12')).toBe(12);
  });

  it('ignora o que não é um id', () => {
    expect(selectedFromSearch('')).toBeNull();
    expect(selectedFromSearch('?publication=0')).toBeNull();
    expect(selectedFromSearch('?publication=12abc')).toBeNull();
    expect(selectedFromSearch('?publication=-1')).toBeNull();
  });
});

describe('searchForSelected', () => {
  it('grava e apaga o parâmetro sem mexer nos outros', () => {
    expect(searchForSelected('?x=1', 5)).toBe('?x=1&publication=5');
    expect(searchForSelected('?publication=5&x=1', null)).toBe('?x=1');
    expect(searchForSelected('?publication=5', null)).toBe('');
  });
});

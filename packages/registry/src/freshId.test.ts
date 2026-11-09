import { describe, expect, it } from 'vitest';
import { freshId } from './freshId';

describe('freshId', () => {
  it('takes the lowest free number from 1', () => {
    expect(freshId('page', new Set())).toBe('page-1');
    expect(freshId('page', new Set(['page-1', 'page-3']))).toBe('page-2');
  });

  it('numbers from `from`, with `sep` between', () => {
    expect(freshId('w', new Set(['w1']), { sep: '' })).toBe('w2');
    expect(freshId('Snapshot', new Set(), { from: 4, sep: ' ' })).toBe('Snapshot 4');
  });

  it('tries the bare base first with `bare`', () => {
    expect(freshId('group', new Set(), { bare: true, from: 2 })).toBe('group');
    expect(freshId('group', new Set(['group']), { bare: true, from: 2 })).toBe('group-2');
  });

  it('numbers a `from` that is not a finite number from 1', () => {
    expect(freshId('page', new Set(['page-1', 'page-NaN']), { from: Number.NaN })).toBe('page-2');
    expect(freshId('page', new Set(['page-Infinity']), { from: Infinity })).toBe('page-1');
  });
});

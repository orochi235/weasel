import { describe, expect, it } from 'vitest';
import { accessMatch } from './access';
import type { MenuEntry } from './entries';

const run = () => {};
const item = (key: string, access?: string): MenuEntry => ({ kind: 'item', key, label: key, run, access });

describe('accessMatch', () => {
  it('finds a letter in either case', () => {
    const entries = [item('a'), item('file', 'F')];
    expect(accessMatch(entries, 'f')).toBe(1);
    expect(accessMatch(entries, 'F')).toBe(1);
  });
  it('returns the first of two rows sharing a letter', () => {
    expect(accessMatch([item('a', 's'), item('b', 's')], 's')).toBe(0);
  });
  it('includes disabled rows', () => {
    expect(accessMatch([{ kind: 'item', key: 'a', label: 'A', run, access: 'a', disabled: true }], 'a')).toBe(0);
  });
  it('returns null for separators only and for an undeclared letter', () => {
    expect(accessMatch([{ kind: 'separator', key: 's' }], 'a')).toBeNull();
    expect(accessMatch([item('a', 'a')], 'z')).toBeNull();
  });
});

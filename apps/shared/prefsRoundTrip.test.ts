import type { PrefLeaf } from '@weasel-js/prefs';
import { describe, expect, it } from 'vitest';
import { otherPrefValue } from './prefsRoundTrip';

const number = (rest: object) => ({ kind: 'number', name: 'n', description: '', ...rest }) as PrefLeaf;

describe('otherPrefValue', () => {
  it('stays inside a number leaf whose default is its max and that has no min', () => {
    expect(otherPrefValue(number({ default: 10, max: 10 }))).toBe(9);
  });

  it('throws its own error for a leaf with no other value', () => {
    expect(() => otherPrefValue(number({ default: 1, min: 1, max: 1 }))).toThrow('no other value');
    const only = { kind: 'enum', name: 'e', description: '', default: 'a', options: [{ value: 'a', label: 'A' }] };
    expect(() => otherPrefValue(only as PrefLeaf)).toThrow('no other value');
  });
});

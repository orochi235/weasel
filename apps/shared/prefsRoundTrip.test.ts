import type { PrefLeaf } from '@weasel-js/prefs';
import type { PrefGroup, PrefsStore } from '@weasel-js/prefs';
import { describe, expect, it, vi } from 'vitest';
import { otherPrefValue, prefsRoundTrip } from './prefsRoundTrip';

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

const SCHEMA = {
  name: 'Test',
  children: { on: { kind: 'boolean', name: 'On', description: '', default: false } },
} satisfies PrefGroup;

describe('prefsRoundTrip', () => {
  it('closes the store it opened when the prefs do not reach storage', async () => {
    const close = vi.fn(async () => {});
    const store = { set: () => {}, flush: async () => false, close };
    const open = () => store as unknown as PrefsStore<typeof SCHEMA>;
    await expect(prefsRoundTrip(SCHEMA, open)).rejects.toThrow('did not reach storage');
    expect(close).toHaveBeenCalledOnce();
  });
});

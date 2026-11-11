/** Counterexamples `cssFamily.pbt.test.ts` shrank to, kept as examples. */
import { describe, expect, it } from 'vitest';
import { cssFamilyName } from './cssFamily';

describe('cssFamilyName, shrunk', () => {
  it('escapes a backslash and a line break as CSS reads them, not as JSON writes them', () => {
    expect(cssFamilyName('\u0001\\')).toBe('"\u0001\\\\"');
    expect(cssFamilyName('a\nb')).toBe('"a\\a b"');
  });
});

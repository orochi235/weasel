/** Proofs `rulesExclusive` missed, as its property test shrank them. */
import { describe, expect, it } from 'vitest';
import { ALWAYS, NEVER } from './rule';
import { rulesExclusive } from './exclusive';

describe('rulesExclusive, shrunk', () => {
  it('proves a compound rule exclusive with its negation', () => {
    expect(rulesExclusive({ not: ALWAYS }, ALWAYS)).toBe(true);
    const both = { all: [{ mode: 'a' }, { focused: true }] };
    expect(rulesExclusive(both, { not: both })).toBe(true);
  });

  it('proves the never-rule exclusive with the always-rule', () => {
    expect(rulesExclusive(NEVER, ALWAYS)).toBe(true);
    expect(rulesExclusive(ALWAYS, NEVER)).toBe(true);
  });

  it('finds a proof in a part of either side when both are conjunctions', () => {
    expect(rulesExclusive(ALWAYS, { all: [{}, NEVER] })).toBe(true);
  });

  it('meets each alternative of one side with a different part of the other', () => {
    const a = { any: [{ focused: true }, { mode: 'x' }] };
    const b = { all: [{ focused: false }, { mode: 'y' }] };
    expect(rulesExclusive(a, b)).toBe(true);
    expect(rulesExclusive(b, a)).toBe(true);
  });
});

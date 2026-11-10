import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { blendPref } from './blend';
import { runs, tally, timeoutFor } from './pbt.fixture';
import type { PrefColor, PrefNumber } from './schema';

const NUMBER: PrefNumber = { kind: 'number', name: 'N', description: '', default: 0 };
const COLOR: PrefColor = { kind: 'color', name: 'C', description: '', default: '#000000' };

const weight = fc.oneof(fc.double({ min: 1e-6, max: 1e6, noNaN: true }), fc.constantFrom(0.1, 0.2, 0.3, 1 / 3, 1, 1e300));
const finite = fc.double({ min: -1e12, max: 1e12, noNaN: true, noDefaultInfinity: true });

describe('blendPref, properties', () => {
  it('folds numbers into a value between the least and the greatest, and equal numbers into that number', () => {
    const t = tally();
    fc.assert(
      fc.property(fc.array(fc.record({ value: finite, weight }), { minLength: 2, maxLength: 5 }), fc.boolean(), (members, equal) => {
        const held = equal ? members.map((m) => ({ ...m, value: members[0]!.value })) : members;
        const read = blendPref(NUMBER, held) as number;
        const values = held.map((m) => m.value);
        t.count(equal ? 'equal' : 'spread');
        expect(read).toBeGreaterThanOrEqual(Math.min(...values));
        expect(read).toBeLessThanOrEqual(Math.max(...values));
        if (equal) expect(read === held[0]!.value).toBe(true);
      }),
      runs(500),
    );
    t.atLeast('equal', 50);
    t.atLeast('spread', 50);
  }, timeoutFor(500, 2));

  it('folds equal numbers into that number when a weight is near the double range (shrunk)', () => {
    const members = [{ value: -179769313.4862316, weight: 0.1 }, { value: -179769313.4862316, weight: 0.1 }, { value: -179769313.4862316, weight: 1e300 }];
    expect(blendPref(NUMBER, members)).toBe(-179769313.4862316);
    expect(blendPref(NUMBER, [{ value: 1, weight: 1e308 }, { value: 3, weight: 1e308 }])).toBe(2);
  });

  it('folds colors into a color, and one color into itself', () => {
    const t = tally();
    const hex = fc.tuple(fc.nat(255), fc.nat(255), fc.nat(255)).map((c) => `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`);
    fc.assert(
      fc.property(fc.array(fc.record({ value: hex, weight }), { minLength: 2, maxLength: 4 }), fc.boolean(), (members, equal) => {
        const held = equal ? members.map((m) => ({ ...m, value: members[0]!.value })) : members;
        const read = blendPref(COLOR, held);
        t.count(equal ? 'equal' : 'spread');
        expect(read).toMatch(/^#[0-9a-f]{6}([0-9a-f]{2})?$/);
        if (equal) expect(read).toBe(held[0]!.value);
      }),
      runs(300),
    );
    t.atLeast('equal', 30);
  }, timeoutFor(300, 2));
});

import { describe, expect, it } from 'vitest';
import { fromCodePoints } from '../BidiDemo';

describe('BidiDemo', () => {
  it('spells out a text far longer than a call takes arguments', () => {
    const cps = Array.from({ length: 1_000_000 }, (_, i) => (i % 2 ? 0x5d0 : 0x1f600));
    const s = fromCodePoints(cps);
    expect([...s]).toHaveLength(cps.length);
    expect(s.codePointAt(0)).toBe(0x1f600);
  });
});

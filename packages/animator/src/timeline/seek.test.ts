import { describe, expect, it } from 'vitest';
import { makeTimeline } from './createTimeline.test-harness';

describe('timeline seek', () => {
  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])('refuses %s, leaving the playhead where it stood', (t) => {
    const tl = makeTimeline({ loop: true });
    tl.advance(40);
    expect(() => tl.handle.seek(t)).toThrow(RangeError);
    tl.advance(50);
    expect(tl.handle.time()).toBe(50);
  });
});

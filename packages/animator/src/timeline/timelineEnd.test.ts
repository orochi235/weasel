import { describe, expect, it } from 'vitest';
import { timelineEnd } from './nestedClock';
import type { NestedTimeline, Track } from './types';

const sampled = (...ts: number[]): Track => ({ kind: 'sampled', keys: ts.map((t) => ({ t, value: 0 })), onTick: () => {} }) as Track;

describe('timelineEnd', () => {
  it('ends at the last track\'s end, a nested timeline\'s from its own `at` and end', () => {
    const inner: NestedTimeline = { tracks: [sampled(0, 300)] };
    expect(timelineEnd({ tracks: [sampled(0, 200), { kind: 'timeline', at: 100, timeline: inner } as Track] })).toBe(400);
    expect(timelineEnd({ tracks: [{ kind: 'timeline', at: 100, timeline: { ...inner, duration: 50 } } as Track] })).toBe(150);
  });

  it('reads a stated duration through the length it is given, refusing NaN by default', () => {
    expect(timelineEnd({ tracks: [], duration: -5 })).toBe(0);
    expect(() => timelineEnd({ tracks: [], duration: Number.NaN })).toThrow(RangeError);
    expect(timelineEnd({ tracks: [], duration: Number.NaN }, (d) => d || 7)).toBe(7);
  });
});

import { describe, expect, it } from 'vitest';
import { frames, range, stepsOf, until, values } from './sweep';

const all = <V>(s: { walk(): Iterable<V> }): V[] => [...s.walk()];

describe('range', () => {
  it('walks the digits, both ends included', () => {
    expect(all(range({ from: 0, to: 9, step: 1 }))).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('keeps a float step free of drift, and stops at or before the end', () => {
    expect(all(range({ from: 0, to: 0.35, step: 0.1 }))).toEqual([0, 0.1, 0.2, 0.3]);
  });

  it('walks downward when the end is below the start', () => {
    expect(all(range({ from: 3, to: 0, step: 1 }))).toEqual([3, 2, 1, 0]);
  });

  it('snaps `at` to a step', () => {
    const s = range({ from: 0, to: 10, step: 5 });
    expect([s.at(0), s.at(0.2), s.at(0.3), s.at(1), s.at(2)]).toEqual([0, 0, 5, 10, 10]);
  });

  it('spaces `count` samples evenly and reads `at` continuously', () => {
    const s = range({ from: 0, to: 1, count: 5 });
    expect(all(s)).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(s.at(0.1)).toBe(0.1);
    expect(all(range({ from: 7, to: 9, count: 1 }))).toEqual([7]);
  });

  it('refuses a step or a count that walks nowhere', () => {
    expect(() => range({ from: 0, to: 1, step: 0 })).toThrow(RangeError);
    expect(() => range({ from: 0, to: 1, count: 0 })).toThrow(RangeError);
    expect(() => range({ from: 0, to: Infinity, count: 3 })).toThrow(RangeError);
  });

  it('refuses a start that is not a finite number, or an end that is not a number', () => {
    expect(() => range({ from: NaN, to: 1, step: 1 })).toThrow(RangeError);
    expect(() => range({ from: -Infinity, to: 1, step: 1 })).toThrow(RangeError);
    expect(() => range({ from: 0, to: NaN, step: 1 })).toThrow(RangeError);
    expect(() => range({ from: NaN, to: 1, count: 2 })).toThrow(RangeError);
  });

  it('walks an endless range as far as it is asked', () => {
    expect(stepsOf(range({ from: 0, to: Infinity, step: 2 }), 3)).toEqual({ steps: [0, 2, 4], capped: true });
  });

  it('refuses a cap that is not a whole number of steps, which never matched the count and walked an endless sweep forever', () => {
    const endless = range({ from: 0, to: Infinity, step: 1 });
    for (const cap of [2.5, -1, NaN]) expect(() => stepsOf(endless, cap)).toThrow(RangeError);
    expect(stepsOf(endless, 0)).toEqual({ steps: [], capped: true });
  });
});

describe('values', () => {
  it('walks the list and snaps `at` to the nearest', () => {
    const s = values(['sm', 'md', 'lg']);
    expect(all(s)).toEqual(['sm', 'md', 'lg']);
    expect([s.at(0), s.at(0.3), s.at(0.8)]).toEqual(['sm', 'md', 'lg']);
    expect(s.label('md')).toBe('md');
  });
});

describe('frames', () => {
  it('stops a looping pass short of its end, which is the next pass’s start', () => {
    expect(all(frames({ duration: 400, loop: true }, { every: 100 }))).toEqual([0, 100, 200, 300]);
  });

  it('shows the last frame of a run that ends, even off the beat', () => {
    expect(all(frames({ duration: 400 }, { every: 100 }))).toEqual([0, 100, 200, 300, 400]);
    expect(all(frames({ duration: 250 }, { every: 100 }))).toEqual([0, 100, 200, 250]);
  });

  it('walks every pass of a counted loop on `passes: all`', () => {
    expect(all(frames({ duration: 200, loop: 2 }, { every: 100, passes: 'all' }))).toEqual([0, 100, 200, 300, 400]);
    expect(all(frames({ duration: 200, loop: 2 }, { every: 100 }))).toEqual([0, 100]);
  });

  it('walks no frames past the end of an endless loop of no length', () => {
    expect(stepsOf(frames({ duration: 0, loop: true }, { every: 10, passes: 'all' }))).toEqual({ steps: [], capped: false });
    expect(stepsOf(frames({ loop: 0 }, { every: 10, passes: 'all' }))).toEqual({ steps: [0], capped: false });
    expect(() => frames({ duration: NaN }, { every: 10 })).toThrow(RangeError);
    expect(() => frames({ duration: -100 }, { every: 10 })).toThrow(RangeError);
  });

  it('labels a frame with the time it shows, origin included', () => {
    const s = frames({ duration: 100, origin: 1000 }, { every: 50 });
    expect(s.label(50)).toBe('1050 ms');
  });

  it('reads `at` continuously over the span walked', () => {
    expect(frames({ duration: 400 }, { every: 100 }).at(0.125)).toBe(50);
  });

  it('never ends without a duration, so a cap or `until` ends it', () => {
    expect(stepsOf(frames({}, { every: 10 }), 4).capped).toBe(true);
    expect(all(until(frames({}, { every: 10 }), (t) => t >= 30))).toEqual([0, 10, 20]);
  });
});

describe('until', () => {
  it('stops before the first step it accepts, and passes the index', () => {
    const seen: number[] = [];
    const s = until(range({ from: 0, to: 9, step: 1 }), (v, i) => {
      seen.push(i);
      return v * v > 10;
    });
    expect(all(s)).toEqual([0, 1, 2, 3]);
    expect(seen).toEqual([0, 1, 2, 3, 4]);
  });
});

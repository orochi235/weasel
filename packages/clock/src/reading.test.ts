import { describe, expect, it } from 'vitest';
import { holdEndOf, nextReading, readingAt, type Reading } from './reading';

const counting = (value: number, at: number): Reading => ({ value, at, rate: 1 / 1000 });

describe('readingAt', () => {
  it('runs on from the value at the rate', () => {
    expect(readingAt(counting(10, 1000), 3500)).toBeCloseTo(12.5);
    expect(readingAt({ value: 10, at: 0, rate: 0 }, 1e6)).toBe(10);
    expect(readingAt({ value: 60, at: 0, rate: -1 / 1000 }, 1500)).toBeCloseTo(58.5);
  });
});

describe('nextReading', () => {
  it('takes the first reading as it is', () => {
    expect(nextReading(undefined, counting(5, 0))).toEqual(counting(5, 0));
  });

  it('re-anchors on an update ahead of what was shown', () => {
    const r = nextReading(counting(10, 0), counting(31, 20_000));
    expect(r).toEqual(counting(31, 20_000));
  });

  it('holds when an update lands behind, then runs on once its line catches up', () => {
    // Shown 30 by 20 s; the server says 29.5.
    const r = nextReading(counting(10, 0), counting(29.5, 20_000));
    expect(r.hold).toBeCloseTo(30);
    expect(readingAt(r, 20_000)).toBeCloseTo(30);
    expect(readingAt(r, 20_400)).toBeCloseTo(30);
    expect(holdEndOf(r)).toBeCloseTo(20_500);
    expect(readingAt(r, 21_500)).toBeCloseTo(31);
  });

  it('snaps back past the longest hold', () => {
    const r = nextReading(counting(10, 0), counting(25, 20_000));
    expect(r.hold).toBeUndefined();
    expect(readingAt(r, 20_000)).toBe(25);
    expect(nextReading(counting(10, 0), counting(25, 20_000), { maxHold: 10_000 }).hold).toBeCloseTo(30);
  });

  it('holds a countdown from below', () => {
    const down = (value: number, at: number): Reading => ({ value, at, rate: -1 / 1000 });
    const r = nextReading(down(60, 0), down(50.5, 10_000));
    expect(r.hold).toBeCloseTo(50);
    expect(readingAt(r, 10_200)).toBeCloseTo(50);
    expect(readingAt(r, 11_500)).toBeCloseTo(49);
  });

  it('snaps to a stopped reading, which never catches up', () => {
    const r = nextReading(counting(10, 0), { value: 29.5, at: 20_000, rate: 0 });
    expect(r.hold).toBeUndefined();
    expect(readingAt(r, 30_000)).toBe(29.5);
  });

  it('drops a hold the update carried in', () => {
    expect(nextReading(counting(0, 0), { ...counting(1, 0), hold: 9 }).hold).toBeUndefined();
  });
});

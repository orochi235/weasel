import { describe, expect, it } from 'vitest';
import { createCodec, type Reader } from './codec';

const linear = (u: number) => u;
/** A subject's `n` axes as the last frame read them. */
const vals = (r: Reader, n: number): number[] =>
  Array.from({ length: n }, (_, i) => r.cols[r.at + i]!);

describe('createCodec holds', () => {
  const T = { name: 'target' };

  it('reads a hold from `at` each frame, with no clock of its own', () => {
    const b = createCodec();
    let x = 5;
    const r = b.hold({ id: 1, on: T, axes: 2, at: () => [x, -x] });
    b.frame(0);
    expect(vals(r, 2)).toEqual([5, -5]);
    x = 9;
    b.frame(0);
    expect(vals(r, 2)).toEqual([9, -9]);
    expect(b.own(1)).toEqual({ value: [9, -9], velocity: [0, 0] });
    b.rate(1, 0);
    x = 11;
    b.frame(16);
    expect(vals(r, 2)).toEqual([11, -11]);
  });

  it('sums a hold with the other voices on its subject', () => {
    const b = createCodec();
    const r = b.hold({ id: 1, on: T, axes: 1, at: () => [40] });
    b.tween({ id: 2, on: T, ms: 1000, ease: linear, from: [10], to: [0] });
    b.frame(0);
    b.frame(500);
    expect(vals(r, 1)[0]).toBeCloseTo(45, 9);
    b.stop(1);
    b.frame(0);
    expect(vals(r, 1)[0]).toBeCloseTo(5, 9);
  });

  it('keeps a hold as the last frame read it until its subject is touched and refreshed', () => {
    const b = createCodec();
    let x = 5;
    const r = b.hold({ id: 1, on: T, axes: 1, at: () => [x] });
    b.frame(0);
    x = 9;
    const seen: unknown[] = [];
    b.refresh((on) => seen.push(on));
    expect(seen).toEqual([]);
    expect(vals(r, 1)).toEqual([5]);
    b.touch(T);
    b.refresh((on) => seen.push(on));
    expect(seen).toEqual([T]);
    expect(vals(r, 1)).toEqual([9]);
    // One touch is one reading.
    b.refresh((on) => seen.push(on));
    expect(seen).toEqual([T]);
  });

  it('tells a refresh what a tween waiting for its first frame would add', () => {
    const b = createCodec();
    const r = b.hold({ id: 1, on: T, axes: 1, at: () => [40] });
    b.frame(0);
    b.tween({ id: 2, on: T, ms: 1000, ease: linear, from: [10], to: [0] });
    b.touch(T);
    let queued: number[] = [];
    b.refresh((_, q) => { queued = q; });
    expect(vals(r, 1)).toEqual([40]);
    expect(queued).toEqual([10]);
    b.frame(0);
    b.touch(T);
    b.refresh((_, q) => { queued = q; });
    expect(queued).toEqual([0]);
    expect(vals(r, 1)).toEqual([50]);
  });

  it('ignores a touch of a subject it has no voice on', () => {
    const b = createCodec();
    b.touch(T);
    let calls = 0;
    b.refresh(() => { calls += 1; });
    expect(calls).toBe(0);
  });
});


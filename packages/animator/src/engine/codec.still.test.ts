import { describe, expect, it } from 'vitest';
import { createCodec, type Reader } from './codec';

const linear = (u: number) => u;
/** A subject's `n` axes as the last frame read them. */
const vals = (r: Reader, n: number): number[] =>
  Array.from({ length: n }, (_, i) => r.cols[r.at + i]!);

describe('createCodec still holds', () => {
  const T = { name: 'target' };

  it('asks a still hold once, and again only after its subject is touched', () => {
    const b = createCodec();
    let x = 5;
    let asked = 0;
    const r = b.hold({ id: 1, on: T, axes: 2, still: true, at: () => { asked += 1; return [x, -x]; } });
    b.frame(0);
    expect(vals(r, 2)).toEqual([5, -5]);
    b.frame(16);
    b.frame(16);
    expect(asked).toBe(1);
    expect(vals(r, 2)).toEqual([5, -5]);
    x = 9;
    b.frame(16);
    expect(vals(r, 2)).toEqual([5, -5]);
    b.touch(T);
    b.touch(T);
    b.refresh(() => {});
    expect(asked).toBe(2);
    expect(vals(r, 2)).toEqual([9, -9]);
    expect(b.own(1)).toEqual({ value: [9, -9], velocity: [0, 0] });
    b.frame(16);
    expect(asked).toBe(2);
    expect(vals(r, 2)).toEqual([9, -9]);
  });

  it('takes a touch between frames up at the next frame', () => {
    const b = createCodec();
    let x = 1;
    const r = b.hold({ id: 1, on: T, axes: 1, still: true, at: () => [x] });
    b.frame(0);
    x = 2;
    b.touch(T);
    b.frame(16);
    expect(vals(r, 1)).toEqual([2]);
  });

  it('goes back to asking every frame once it is told it is not still', () => {
    const b = createCodec();
    let x = 1;
    const r = b.hold({ id: 1, on: T, axes: 1, still: true, at: () => [x] });
    b.frame(0);
    b.still(1, false);
    x = 3;
    b.frame(16);
    expect(vals(r, 1)).toEqual([3]);
    b.still(1, true);
    b.frame(16);
    x = 4;
    b.frame(16);
    expect(vals(r, 1)).toEqual([3]);
  });

  it('sums a still hold with a tween, and leaves the tween when it stops', () => {
    const b = createCodec();
    const r = b.hold({ id: 1, on: T, axes: 1, still: true, at: () => [40] });
    b.tween({ id: 2, on: T, ms: 1000, ease: linear, from: [10], to: [0] });
    b.frame(0);
    b.frame(500);
    expect(vals(r, 1)[0]).toBeCloseTo(45, 9);
    b.stop(1);
    b.frame(0);
    expect(vals(r, 1)[0]).toBeCloseTo(5, 9);
    expect(b.voiceCount()).toBe(1);
  });

  it('stops a still hold that no frame or touch has cued', () => {
    const b = createCodec();
    b.hold({ id: 1, on: T, axes: 1, still: true, at: () => [40] });
    b.stop(1);
    b.frame(0);
    expect(b.voiceCount()).toBe(0);
  });
});

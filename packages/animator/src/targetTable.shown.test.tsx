import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { linear } from '@weasel-js/geom';
import { createTargetTable } from './targetTable';
import { useAnimator } from './useAnimator';

function setup() {
  const cbs: ((t: number) => void)[] = [];
  let now = 0;
  const { result } = renderHook(() => useAnimator({
    now: () => now,
    requestFrame: (cb) => { cbs.push(cb); return cbs.length; },
    cancelFrame: () => {},
  }));
  const frame = (t: number): void => act(() => { now = t; for (const cb of cbs.splice(0)) cb(t); });
  return { animator: result.current, frame };
}

describe('a target table asked for `shown` as a Float32Array', () => {
  it('keeps `shown` in one, and `committed` in a Float64Array', () => {
    const t = createTargetTable({ axes: 2, shown: Float32Array });
    const row = t.add([1.5, 0.1]);
    expect(t.shown).toBeInstanceOf(Float32Array);
    expect(t.committed).toBeInstanceOf(Float64Array);
    expect(Array.from(t.shown.subarray(row * 2, row * 2 + 2))).toEqual([1.5, Math.fround(0.1)]);
    expect(t.committed[1]).toBe(0.1);
    t.set(row, [2.5, 3.5]);
    expect(Array.from(t.shown.subarray(0, 2))).toEqual([2.5, 3.5]);
  });

  it('is a Float64Array where nothing is asked for', () => {
    const t = createTargetTable({ axes: 1 });
    expect(t.shown).toBeInstanceOf(Float64Array);
  });

  it('fills it from the pass as rows move, and from a row read by itself', () => {
    const { animator, frame } = setup();
    const t = createTargetTable({ axes: 1, shown: Float32Array });
    const a = t.add([0]);
    const b = t.add([10]);
    act(() => {
      animator.tween({ target: t.target(a), to: [100], ms: 100, easing: linear });
      animator.hold({ target: t.target(b), value: [30], weight: 0.5 });
    });
    // A row is read by itself until the frame after it starts moving.
    expect(t.shown[a]).toBe(0);
    expect(t.shown[b]).toBe(20);
    frame(0);
    frame(50);
    expect(t.shown[a]).toBeCloseTo(50, 4);
    expect(t.shown[b]).toBe(20);
    frame(100);
    frame(116);
    expect(t.shown[a]).toBe(100);
  });

  it('is still one once the table grows, with what it showed', () => {
    const t = createTargetTable({ axes: 1, capacity: 2, shown: Float32Array });
    for (let i = 0; i < 9; i++) t.add([i + 0.5]);
    expect(t.shown).toBeInstanceOf(Float32Array);
    expect(Array.from(t.shown.subarray(0, 9))).toEqual([0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5]);
  });
});

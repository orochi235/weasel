import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { linear } from '@weasel-js/geom';
import { stateOf } from './target';
import { createTargetTable, type TargetTable } from './targetTable';
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

/**
 * Counts reads of `row`'s committed value through its target. A row read by itself reads its
 * committed value through `get`, and the table's pass reads its arrays, so a count of 0 over
 * frames that show the row is a proxy for "the pass showed it".
 */
function countReads(t: TargetTable, row: number): () => number {
  const s = stateOf(t.target(row)) as { get: () => unknown };
  const get = s.get;
  let reads = 0;
  s.get = () => { reads += 1; return get(); };
  return () => reads;
}

const shown = (t: TargetTable, row: number): number[] => Array.from(t.shown.subarray(row * t.axes, (row + 1) * t.axes));
/** Runs a frame at `at`, and answers how many times it read `row` by itself and what the row
 *  shows, read the slow way after it. */
const frameOf = (frame: (t: number) => void, t: TargetTable, row: number, reads: () => number, at: number) => {
  const before = reads();
  frame(at);
  void t.shown;
  return { reads: reads() - before, value: t.target(row).read() };
};

describe('a target table row with an animation behind a hold', () => {
  it('is shown by the pass, not read by itself', () => {
    const { animator, frame } = setup();
    const t = createTargetTable({ axes: 2 });
    const row = t.add([0, 0]);
    act(() => {
      animator.tween({ target: t.target(row), from: [10, 0], to: [100, 100], ms: 1000, easing: linear });
      animator.hold({ target: t.target(row), value: [40, 40], weight: 0.5 });
    });
    frame(0);
    frame(16);
    const reads = countReads(t, row);
    for (let f = 2; f < 10; f++) {
      const want = frameOf(frame, t, row, reads, f * 16);
      expect(want.reads).toBe(0);
      const got = shown(t, row);
      expect(got[0]).toBeCloseTo(want.value[0]!, 9);
      expect(got[1]).toBeCloseTo(want.value[1]!, 9);
    }
  });

  it('shows the share of a move a released hold left, in the pass', () => {
    const { animator, frame } = setup();
    const t = createTargetTable({ axes: 1 });
    const row = t.add([0]);
    const other = t.add([0]);
    let h!: ReturnType<typeof animator.hold>;
    act(() => {
      animator.tween({ target: t.target(row), to: [100], ms: 1000, easing: linear });
      animator.hold({ target: t.target(row), value: [20], weight: 0.25 });
      h = animator.hold({ target: t.target(row), value: [60], weight: 0.5 });
      animator.tween({ target: t.target(other), to: [5], ms: 5000, easing: linear });
    });
    frame(0);
    frame(400);
    act(() => { h.release(); });
    frame(416);
    const reads = countReads(t, row);
    for (const at of [500, 700, 900]) {
      const want = frameOf(frame, t, row, reads, at);
      expect(want.reads).toBe(0);
      expect(shown(t, row)[0]).toBeCloseTo(want.value[0]!, 9);
    }
  });

  it('shows what a stopped animation left beside the holds, in the pass', () => {
    const { animator, frame } = setup();
    const t = createTargetTable({ axes: 1 });
    const row = t.add([10]);
    let tw!: ReturnType<typeof animator.tween>;
    act(() => {
      animator.hold({ target: t.target(row), value: [70], weight: 0.5 });
      tw = animator.tween({ target: t.target(row), from: [30], to: [10], ms: 1000, easing: linear });
    });
    frame(0);
    frame(500);
    act(() => { tw.cancel(); });
    frame(516);
    const reads = countReads(t, row);
    const want = frameOf(frame, t, row, reads, 532);
    expect(want.reads).toBe(0);
    expect(shown(t, row)[0]).toBeCloseTo(want.value[0]!, 9);
    expect(want.value[0]).toBeCloseTo(50, 9);
  });
});

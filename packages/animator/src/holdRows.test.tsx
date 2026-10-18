import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { linear } from '@weasel-js/geom';
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
  return { animator: result.current, frame, pending: () => cbs.length };
}

const shown = (t: TargetTable, row: number): number[] =>
  Array.from(t.shown.subarray(row * t.axes, (row + 1) * t.axes));

function table3() {
  const t = createTargetTable({ axes: 2 });
  for (let r = 0; r < 3; r++) t.add([r * 10, r * 10]);
  return t;
}

describe('animator.holdRows', () => {
  it('holds rows at values written in place, shown as soon as it is touched', () => {
    const { animator, frame } = setup();
    const t = table3();
    let h!: ReturnType<typeof animator.holdRows>;
    act(() => { h = animator.holdRows({ table: t, rows: [0, 2] }); });
    expect(Array.from(h.values.subarray(4, 6))).toEqual([20, 20]);
    expect(shown(t, 2)).toEqual([20, 20]);
    h.values.set([50, 60], 4);
    h.values.set([1, 2], 0);
    act(() => { h.touch(); });
    expect(shown(t, 2)).toEqual([50, 60]);
    expect(shown(t, 0)).toEqual([1, 2]);
    expect(shown(t, 1)).toEqual([10, 10]);
    expect(t.target(2).read()).toEqual([50, 60]);
    expect(Array.from(t.committed.subarray(4, 6))).toEqual([20, 20]);
    frame(16);
    expect(shown(t, 2)).toEqual([50, 60]);
  });

  it('weighs each row by its own weight, against the committed value and the row\'s other holds', () => {
    const { animator } = setup();
    const t = table3();
    let h!: ReturnType<typeof animator.holdRows>;
    act(() => {
      h = animator.holdRows({ table: t, rows: [1, 2], weight: 0.5 });
      animator.hold({ target: t.target(2), value: [100, 100], weight: 0.5 });
    });
    h.values.set([30, 30], 2);
    h.values.set([0, 0], 4);
    h.weights[1] = 1;
    act(() => { h.touch(); });
    expect(shown(t, 1)).toEqual([30, 30]);
    expect(shown(t, 2)).toEqual([50, 50]);
  });

  it('holds only the axes it is given', () => {
    const { animator } = setup();
    const t = table3();
    let h!: ReturnType<typeof animator.holdRows>;
    act(() => { h = animator.holdRows({ table: t, rows: [1], axes: [1] }); });
    h.values.set([99, 99], 2);
    act(() => { h.touch(); });
    expect(shown(t, 1)).toEqual([10, 99]);
  });

  it('covers a tween behind it, and commits what each row showed on release', () => {
    const { animator, frame } = setup();
    const t = table3();
    let h!: ReturnType<typeof animator.holdRows>;
    act(() => {
      animator.tween({ target: t.target(0), to: [40, 40], ms: 1000, easing: linear });
      h = animator.holdRows({ table: t });
    });
    h.values.set([7, 7, 8, 8, 9, 9]);
    act(() => { h.touch(); });
    frame(0);
    frame(500);
    expect(shown(t, 0)).toEqual([7, 7]);
    act(() => { h.release(); });
    expect(Array.from(t.committed.subarray(0, 6))).toEqual([7, 7, 8, 8, 9, 9]);
    frame(516);
    expect(shown(t, 0)).toEqual([7, 7]);
  });

  it('falls back to the committed values when released without committing', () => {
    const { animator } = setup();
    const t = table3();
    let h!: ReturnType<typeof animator.holdRows>;
    act(() => { h = animator.holdRows({ table: t }); });
    h.values.fill(5);
    act(() => { h.touch(); h.release({ commit: false }); });
    expect(Array.from(t.shown.subarray(0, 6))).toEqual([0, 0, 10, 10, 20, 20]);
    expect(t.target(1).active).toBe(false);
  });

  it('lets go of a row that is stopped or removed, and goes on holding the rest', () => {
    const { animator } = setup();
    const t = table3();
    let h!: ReturnType<typeof animator.holdRows>;
    act(() => { h = animator.holdRows({ table: t }); });
    h.values.fill(5);
    act(() => { h.touch(); });
    act(() => { t.target(0).stop({ commit: false }); t.remove(1); });
    expect(shown(t, 0)).toEqual([0, 0]);
    expect(t.target(0).active).toBe(false);
    expect(shown(t, 2)).toEqual([5, 5]);
    expect(animator.isActive()).toBe(true);
    const row = t.add([3, 3]);
    expect(shown(t, row)).toEqual([3, 3]);
  });

  it('asks for no frames of its own, and is canceled by its key', () => {
    const { animator, frame, pending } = setup();
    const t = table3();
    act(() => { animator.holdRows({ table: t, cancelKey: 'drag' }); });
    frame(0);
    frame(16);
    expect(pending()).toBe(0);
    act(() => { animator.cancelKey('drag'); });
    expect(animator.isActive()).toBe(false);
    expect(t.target(0).active).toBe(false);
  });
});

import { describe, expect, it, vi } from 'vitest';
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

/** A row's value on screen, as the table shows it. */
const shown = (t: TargetTable, row: number): number[] =>
  Array.from(t.shown.subarray(row * t.axes, (row + 1) * t.axes));
const committed = (t: TargetTable, row: number): number[] =>
  Array.from(t.committed.subarray(row * t.axes, (row + 1) * t.axes));

describe('a target table', () => {
  it('says which row was committed, and once a frame that its rows were shown', () => {
    const { animator, frame } = setup();
    const sets: number[] = [];
    let shows = 0;
    const t = createTargetTable({ axes: 1, set: (row) => sets.push(row), show: () => { shows += 1; } });
    const a = t.add([0]);
    const b = t.add([0]);
    expect(sets).toEqual([]);
    t.set(b, [3]);
    expect(sets).toEqual([b]);
    act(() => { animator.tween({ target: t.target(a), to: [10], ms: 100, easing: linear }); });
    expect(sets).toEqual([b, a]);
    expect(shows).toBe(0);
    frame(0);
    frame(50);
    expect(shows).toBe(2);
    frame(100);
    frame(116);
    const rested = shows;
    frame(132);
    expect(shows).toBe(rested);
  });

  it('refuses a write through the target of a row that was removed', () => {
    const t = createTargetTable({ axes: 1 });
    const a = t.add([1]);
    const stale = t.target(a);
    t.remove(a);
    const b = t.add([7]);
    expect(b).toBe(a);
    expect(() => stale.commit([2])).toThrow('was removed');
    expect(() => stale.read()).toThrow('was removed');
    expect(shown(t, b)).toEqual([7]);
  });

  it('shows each row at its committed value while nothing moves it', () => {
    const t = createTargetTable({ axes: 2 });
    const a = t.add([1, 2]);
    const b = t.add([3, 4]);
    expect(t.size).toBe(2);
    expect(shown(t, a)).toEqual([1, 2]);
    expect(shown(t, b)).toEqual([3, 4]);
    t.set(a, [9, 8]);
    expect(committed(t, a)).toEqual([9, 8]);
    expect(shown(t, a)).toEqual([9, 8]);
  });

  it('shows a moving row where its target reads, frame by frame, and leaves the others alone', () => {
    const { animator, frame } = setup();
    const t = createTargetTable({ axes: 2 });
    const a = t.add([0, 10]);
    const b = t.add([5, 5]);
    act(() => { animator.tween({ target: t.target(a), to: [100, 10], ms: 100, easing: linear }); });
    expect(committed(t, a)).toEqual([100, 10]);
    // Started between frames, it has not moved on screen.
    expect(shown(t, a)).toEqual([0, 10]);
    frame(0);
    frame(50);
    expect(shown(t, a)[0]).toBeCloseTo(50, 9);
    expect(shown(t, a)).toEqual(t.target(a).read());
    expect(shown(t, b)).toEqual([5, 5]);
    frame(100);
    frame(116);
    expect(shown(t, a)).toEqual([100, 10]);
    expect(t.target(a).active).toBe(false);
  });

  it('adds a second animation on a row to the first', () => {
    const { animator, frame } = setup();
    const t = createTargetTable({ axes: 1 });
    const a = t.add([0]);
    act(() => { animator.tween({ target: t.target(a), to: [100], ms: 100, easing: linear }); });
    frame(0);
    frame(50);
    act(() => { animator.tween({ target: t.target(a), to: [200], ms: 100, easing: linear }); });
    expect(shown(t, a)[0]).toBeCloseTo(50, 9);
    frame(100);
    expect(shown(t, a)[0]).toBeCloseTo(150, 9);
  });

  it('keeps a canceled row where it was on screen', () => {
    const { animator, frame } = setup();
    const t = createTargetTable({ axes: 1 });
    const a = t.add([0]);
    let h!: ReturnType<typeof animator.tween>;
    act(() => { h = animator.tween({ target: t.target(a), to: [100], ms: 100, easing: linear }); });
    frame(0);
    frame(25);
    act(() => { h.cancel(); });
    expect(shown(t, a)[0]).toBeCloseTo(25, 9);
    expect(committed(t, a)[0]).toBeCloseTo(25, 9);
    frame(40);
    expect(shown(t, a)[0]).toBeCloseTo(25, 9);
  });

  it('shows a value held on a row, and what is left of the row when the hold goes', () => {
    const { animator, frame } = setup();
    const t = createTargetTable({ axes: 2 });
    const a = t.add([10, 10]);
    let h!: ReturnType<typeof animator.hold>;
    act(() => { h = animator.hold({ target: t.target(a), value: [70, 70], weight: 0.5 }); });
    expect(shown(t, a)).toEqual([40, 40]);
    frame(0);
    frame(16);
    expect(shown(t, a)).toEqual([40, 40]);
    t.set(a, [30, 10]);
    expect(shown(t, a)).toEqual([50, 40]);
    frame(32);
    frame(48);
    expect(shown(t, a)).toEqual([50, 40]);
    act(() => { h.release({ commit: false }); });
    expect(shown(t, a)).toEqual([30, 10]);
  });

  it('shows a held row from the pass over the table, with no read of the row by itself', () => {
    const { animator, frame } = setup();
    const t = createTargetTable({ axes: 2 });
    const a = t.add([10, 10]);
    let weight = 0.5;
    let h!: ReturnType<typeof animator.hold>;
    act(() => { h = animator.hold({ target: t.target(a), value: [70, 70], weight: () => weight }); });
    frame(0);
    frame(50);
    // A read of a held row by itself asks its axes for the committed value's, which the pass
    // never does.
    const axes = stateOf(t.target(a)).axes;
    const to = vi.spyOn(axes, 'to');
    const write = vi.spyOn(axes, 'write');
    frame(60);
    frame(70);
    expect(shown(t, a)).toEqual([40, 40]);
    expect(to).not.toHaveBeenCalled();
    // The hold's own voice writes its value's axes, once a frame.
    expect(write).toHaveBeenCalledTimes(2);
    to.mockRestore();
    write.mockRestore();
    expect(shown(t, a)).toEqual(t.target(a).read());
    weight = 1;
    act(() => { h.touch(); });
    expect(shown(t, a)).toEqual([70, 70]);
    frame(80);
    expect(shown(t, a)).toEqual(t.target(a).read());
  });

  it('shows a hold whose value an animation changes in its own tick, that frame', () => {
    const { animator, frame } = setup();
    const t = createTargetTable({ axes: 1 });
    const a = t.add([0]);
    const driver = t.add([0]);
    let value = 10;
    let h!: ReturnType<typeof animator.hold>;
    act(() => { h = animator.hold({ target: t.target(a), value: () => [value], weight: 1 }); });
    act(() => {
      animator.tween({
        target: t.target(driver), to: [100], ms: 100, easing: linear,
        onTick: (v) => { value = 10 + v[0]!; h.touch(); },
      });
    });
    frame(0);
    for (const at of [20, 40, 60]) {
      frame(at);
      expect(shown(t, a)[0]).toBeCloseTo(10 + at, 9);
      expect(shown(t, a)).toEqual(t.target(a).read());
    }
  });

  it('shows a tween under a hold as far as the hold leaves it, frame by frame', () => {
    const { animator, frame } = setup();
    const t = createTargetTable({ axes: 1 });
    const a = t.add([0]);
    act(() => { animator.hold({ target: t.target(a), value: [50], weight: 0.5 }); });
    frame(0);
    frame(16);
    act(() => { animator.tween({ target: t.target(a), to: [100], ms: 100, easing: linear }); });
    for (const at of [16, 36, 66, 116, 132, 148]) {
      frame(at);
      expect(shown(t, a)).toEqual(t.target(a).read());
    }
    expect(shown(t, a)[0]).toBeCloseTo(75, 9);
  });

  it('moves a row on screen at once when its committed value is set under an animation', () => {
    const { animator, frame } = setup();
    const t = createTargetTable({ axes: 1 });
    const a = t.add([0]);
    act(() => { animator.tween({ target: t.target(a), to: [100], ms: 100, easing: linear }); });
    frame(0);
    frame(50);
    t.set(a, [110]);
    expect(shown(t, a)[0]).toBeCloseTo(60, 9);
    frame(60);
    expect(shown(t, a)[0]).toBeCloseTo(70, 9);
  });

  it('keeps two tables with as many axes apart', () => {
    const { animator, frame } = setup();
    const t = createTargetTable({ axes: 1 });
    const u = createTargetTable({ axes: 1 });
    const a = t.add([0]);
    const b = u.add([1000]);
    act(() => {
      animator.tween({ target: t.target(a), to: [100], ms: 100, easing: linear });
      animator.tween({ target: u.target(b), to: [0], ms: 100, easing: linear });
    });
    frame(0);
    frame(50);
    expect(shown(t, a)[0]).toBeCloseTo(50, 9);
    expect(shown(u, b)[0]).toBeCloseTo(500, 9);
  });

  it('grows past its first capacity, keeping every row', () => {
    const t = createTargetTable({ axes: 2, capacity: 2 });
    const rows = Array.from({ length: 9 }, (_, i) => t.add([i, -i]));
    expect(rows).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(shown(t, 8)).toEqual([8, -8]);
    expect(committed(t, 0)).toEqual([0, -0]);
  });

  it('gives a removed row to the next add, and stops what was moving it', () => {
    const { animator, frame } = setup();
    const t = createTargetTable({ axes: 1 });
    const a = t.add([0]);
    t.add([1]);
    act(() => { animator.tween({ target: t.target(a), to: [100], ms: 100, easing: linear }); });
    frame(0);
    frame(50);
    act(() => { t.remove(a); });
    expect(animator.isActive()).toBe(false);
    expect(t.size).toBe(1);
    const again = t.add([7]);
    expect(again).toBe(a);
    expect(shown(t, again)).toEqual([7]);
    frame(70);
    expect(shown(t, again)).toEqual([7]);
  });

  it('refuses a value that is not as wide as its rows', () => {
    const t = createTargetTable({ axes: 2 });
    expect(() => t.add([1])).toThrow(/2/);
  });

  it('shows what every row target reads through rows starting, stopping, and finishing', () => {
    const { animator, frame } = setup();
    const t = createTargetTable({ axes: 2, capacity: 4 });
    const N = 60;
    for (let i = 0; i < N; i++) t.add([i, 2 * i]);
    const handles = new Map<number, ReturnType<typeof animator.tween>>();
    // A fixed sequence: a row starts, and every third step an earlier one is canceled.
    let seed = 7;
    const next = (n: number): number => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
    let now = 0;
    const agree = (): void => {
      for (let row = 0; row < N; row++) {
        const want = t.target(row).read();
        expect(shown(t, row)[0]).toBeCloseTo(want[0]!, 9);
        expect(shown(t, row)[1]).toBeCloseTo(want[1]!, 9);
      }
    };
    frame(now);
    for (let step = 0; step < 80; step++) {
      const row = next(N);
      act(() => {
        const to = [next(500), next(500)];
        handles.set(row, step % 2
          ? animator.spring({ target: t.target(row), to })
          : animator.tween({ target: t.target(row), to, ms: 20 + next(120), easing: linear }));
        if (step % 3 === 0) handles.get(next(N))?.cancel();
      });
      agree();
      now += 16;
      frame(now);
      agree();
    }
  });
});

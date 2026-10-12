import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { createTarget } from './target';
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

describe('a hold of plain values', () => {
  it('reads its target once, however many frames run', () => {
    const { animator, frame } = setup();
    let reads = 0;
    let committed = 10;
    const target = createTarget<number>({ get: () => { reads += 1; return committed; }, set: (v) => { committed = v; } });
    act(() => {
      animator.hold({ target, value: 70, weight: 0.5 });
      animator.keepAlive();
    });
    frame(0);
    reads = 0;
    for (let t = 16; t <= 160; t += 16) frame(t);
    expect(reads).toBe(0);
    expect(target.read()).toBe(40);
  });

  it('shows a committed value that moved under it at the next read', () => {
    const { animator, frame } = setup();
    let committed = 10;
    const target = createTarget<number>({ get: () => committed, set: (v) => { committed = v; } });
    act(() => { animator.hold({ target, value: 70, weight: 0.5 }); });
    frame(0);
    committed = 30;
    expect(target.read()).toBe(50);
    frame(16);
    expect(target.read()).toBe(50);
  });

  it('shows a table row committed under it in the pass after', () => {
    const { animator, frame } = setup();
    const table = createTargetTable({ axes: 1 });
    const row = table.add([10]);
    act(() => {
      animator.hold({ target: table.target(row), value: [70], weight: 0.5 });
      animator.keepAlive();
    });
    frame(0);
    frame(16);
    expect(table.shown[row]).toBe(40);
    table.set(row, [30]);
    frame(32);
    frame(48);
    expect(table.shown[row]).toBe(50);
  });

  it('is read every frame again while a hold of a function shares its target', () => {
    const { animator, frame } = setup();
    let committed = 0;
    let x = 100;
    const target = createTarget<number>({ get: () => committed, set: (v) => { committed = v; }, show: () => {} });
    let live: { release(): void } | undefined;
    act(() => {
      animator.hold({ target, value: 50, weight: 0.5 });
      live = animator.hold({ target, value: () => x, weight: 0.5 });
    });
    frame(0);
    expect(target.read()).toBe(75);
    x = 200;
    frame(16);
    expect(target.read()).toBe(125);
    act(() => live!.release());
    expect(target.read()).toBe(125);
    frame(32);
    expect(target.read()).toBe(125);
  });

  it('shows a new value once its handle is touched', () => {
    const { animator, frame } = setup();
    let committed = 0;
    const target = createTarget<number[]>({ get: () => [committed], set: (v) => { committed = v[0]!; } });
    const value = [10];
    let h: { touch(): void } | undefined;
    act(() => { h = animator.hold({ target, value }); });
    frame(0);
    value[0] = 20;
    act(() => h!.touch());
    expect(target.read()).toEqual([20]);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAnimator } from '@weasel-js/animator/react';
import { animateLifecycle } from './animateLifecycle';
import { animateOnSetPose } from './animateOnSetPose';

interface RectPose { x: number; y: number; width: number; height: number }
interface Obj { id: string; pose: RectPose }

function makeAdapter(initial: Map<string, RectPose>) {
  const insertNode = vi.fn((o: Obj) => initial.set(o.id, o.pose));
  const removeNode = vi.fn((id: string) => initial.delete(id));
  const setPose = vi.fn((id: string, p: RectPose) => initial.set(id, p));
  return {
    base: {
      getNodes: () => [],
      getNode: (id: string) => (initial.has(id) ? { id, pose: initial.get(id)! } : undefined),
      getSelection: () => [],
      hitTest: () => null,
      getPose: (id: string) => initial.get(id)!,
      getParent: () => null,
      setPose,
      setParent: () => {},
      insertNode,
      removeNode,
      setSelection: () => {},
    },
    insertNode,
    removeNode,
    setPose,
  };
}

function makeClock() {
  let now = 0;
  const cbs = new Map<number, (t: number) => void>();
  let h = 1;
  return {
    now: () => now,
    requestFrame: (cb: (t: number) => void) => { const id = h++; cbs.set(id, cb); return id; },
    cancelFrame: (id: number) => cbs.delete(id),
    advance: (dt: number) => { now += dt; const due = [...cbs.values()]; cbs.clear(); for (const cb of due) cb(now); },
  };
}

describe('animateLifecycle.insert', () => {
  it('inserts immediately, then tweens visible pose from enterFrom to final', () => {
    const clock = makeClock();
    const initial = new Map<string, RectPose>();
    const { base, insertNode, setPose } = makeAdapter(initial);
    const { result } = renderHook(() => useAnimator(clock));
    const wrapped = animateLifecycle(base, result.current, {
      enterFrom: (p: RectPose) => ({ ...p, width: 0, height: 0 }),
      ms: 100,
    });
    act(() => {
      wrapped.insertNode({ id: 'a', pose: { x: 10, y: 10, width: 20, height: 20 } });
    });
    expect(insertNode).toHaveBeenCalledTimes(1);
    // First setPose call should have set the entry pose (width 0).
    expect(setPose).toHaveBeenCalledWith('a', { x: 10, y: 10, width: 0, height: 0 });
    act(() => clock.advance(0));
    act(() => clock.advance(100));
    const last = setPose.mock.calls[setPose.mock.calls.length - 1][1];
    expect(last.width).toBeCloseTo(20, 1);
    expect(last.height).toBeCloseTo(20, 1);
  });
});

describe('animateLifecycle.remove', () => {
  it('tweens to exitTo first, calls removeNode only after settle', () => {
    const clock = makeClock();
    const initial = new Map<string, RectPose>([['a', { x: 0, y: 0, width: 20, height: 20 }]]);
    const { base, removeNode, setPose } = makeAdapter(initial);
    const { result } = renderHook(() => useAnimator(clock));
    const wrapped = animateLifecycle(base, result.current, {
      exitTo: (p: RectPose) => ({ ...p, width: 0, height: 0 }),
      ms: 100,
    });
    act(() => {
      wrapped.removeNode('a');
    });
    expect(removeNode).not.toHaveBeenCalled();
    act(() => clock.advance(0));
    act(() => clock.advance(100));
    const last = setPose.mock.calls[setPose.mock.calls.length - 1][1];
    expect(last.width).toBeCloseTo(0, 1);
    expect(removeNode).toHaveBeenCalledWith('a');
  });

  it('removes the node when the exit tween is canceled', () => {
    const clock = makeClock();
    const initial = new Map<string, RectPose>([['a', { x: 0, y: 0, width: 20, height: 20 }]]);
    const { base, removeNode } = makeAdapter(initial);
    const { result } = renderHook(() => useAnimator(clock));
    const wrapped = animateLifecycle(base, result.current, {
      exitTo: (p: RectPose) => ({ ...p, width: 0, height: 0 }),
      ms: 100,
    });
    act(() => { wrapped.removeNode('a'); });
    act(() => clock.advance(50));
    act(() => result.current.cancelAll());
    expect(removeNode).toHaveBeenCalledTimes(1);
    expect(removeNode).toHaveBeenCalledWith('a');
  });

  it('removes the node once when removal is asked for again mid-exit', () => {
    const clock = makeClock();
    const initial = new Map<string, RectPose>([['a', { x: 0, y: 0, width: 20, height: 20 }]]);
    const { base, removeNode } = makeAdapter(initial);
    const { result } = renderHook(() => useAnimator(clock));
    const wrapped = animateLifecycle(base, result.current, {
      exitTo: (p: RectPose) => ({ ...p, width: 0, height: 0 }),
      ms: 100,
    });
    act(() => { wrapped.removeNode('a'); });
    act(() => clock.advance(50));
    act(() => { wrapped.removeNode('a'); });
    expect(removeNode).not.toHaveBeenCalled();
    act(() => clock.advance(100));
    expect(removeNode).toHaveBeenCalledTimes(1);
  });
});

describe('animateLifecycle over animateOnSetPose', () => {
  it('enters from the start pose without gliding there or recording an op', () => {
    const clock = makeClock();
    const initial = new Map<string, RectPose>();
    const { base, setPose } = makeAdapter(initial);
    const applyOps = vi.fn();
    const { result } = renderHook(() => useAnimator(clock));
    // A wrapper between the two that knows nothing of either still carries the write through.
    const gliding = { ...animateOnSetPose({ ...base, applyOps }, result.current, { ms: 100 }) };
    const wrapped = animateLifecycle(gliding, result.current, {
      enterFrom: (p: RectPose) => ({ ...p, x: -50 }),
      ms: 100,
    });
    act(() => {
      wrapped.insertNode({ id: 'a', pose: { x: 10, y: 10, width: 20, height: 20 } });
    });
    expect(applyOps).not.toHaveBeenCalled();
    expect(setPose.mock.calls).toEqual([['a', { x: -50, y: 10, width: 20, height: 20 }]]);
    act(() => clock.advance(0));
    act(() => clock.advance(100));
    expect(initial.get('a')).toEqual({ x: 10, y: 10, width: 20, height: 20 });
    expect(applyOps).not.toHaveBeenCalled();
  });
});

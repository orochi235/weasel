import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubReducedMotion } from '@weasel-js/react/testing/stubMatchMedia';
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
    // The last frame shown, before the pose is put back for the removal.
    const shown = setPose.mock.calls[setPose.mock.calls.length - 2][1];
    expect(shown.width).toBeCloseTo(0, 1);
    expect(removeNode).toHaveBeenCalledWith('a');
  });

  it('removes the node as it stood, not at the exit pose, over an adapter without pose targets', () => {
    const clock = makeClock();
    const initial = new Map<string, RectPose>([['a', { x: 0, y: 0, width: 20, height: 20 }]]);
    const { base, removeNode } = makeAdapter(initial);
    let poseAtRemoval: RectPose | undefined;
    removeNode.mockImplementation((id: string) => { poseAtRemoval = initial.get(id); return initial.delete(id); });
    const { result } = renderHook(() => useAnimator(clock));
    const wrapped = animateLifecycle(base, result.current, {
      exitTo: (p: RectPose) => ({ ...p, width: 0, height: 0 }),
      ms: 100,
    });
    act(() => { wrapped.removeNode('a'); });
    act(() => clock.advance(0));
    act(() => clock.advance(100));
    expect(removeNode).toHaveBeenCalledTimes(1);
    expect(poseAtRemoval).toEqual({ x: 0, y: 0, width: 20, height: 20 });
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

describe('animateLifecycle when the node comes back or the tween cannot run', () => {
  const SHRINK = (p: RectPose) => ({ ...p, width: 0, height: 0 });
  const NO_LERP = {
    getBounds: (p: RectPose) => p, remapBounds: (p: RectPose) => p, fromBounds: (b: RectPose) => b,
  };

  it('keeps a node inserted again while its exit runs, at the pose it was inserted with', () => {
    for (const enterFrom of [undefined, SHRINK]) {
      const clock = makeClock();
      const initial = new Map<string, RectPose>([['a', { x: 0, y: 0, width: 20, height: 20 }]]);
      const { base, removeNode } = makeAdapter(initial);
      const { result } = renderHook(() => useAnimator(clock));
      const wrapped = animateLifecycle(base, result.current, { exitTo: SHRINK, enterFrom, ms: 100 });
      act(() => { wrapped.removeNode('a'); });
      act(() => clock.advance(50));
      act(() => { wrapped.insertNode({ id: 'a', pose: { x: 5, y: 5, width: 30, height: 30 } }); });
      act(() => clock.advance(100));
      act(() => clock.advance(100));
      expect(removeNode).toHaveBeenCalledTimes(1);
      expect(initial.get('a')).toEqual({ x: 5, y: 5, width: 30, height: 30 });
    }
  });

  it('never inserts an id the adapter still holds when the node comes back mid-exit', () => {
    const clock = makeClock();
    const initial = new Map<string, RectPose>([['a', { x: 0, y: 0, width: 20, height: 20 }]]);
    const { base } = makeAdapter(initial);
    const strict = {
      ...base,
      insertNode: (o: Obj) => {
        if (initial.has(o.id)) throw new Error(`id collision on "${o.id}"`);
        base.insertNode(o);
      },
    };
    const { result } = renderHook(() => useAnimator(clock));
    const wrapped = animateLifecycle(strict, result.current, { exitTo: SHRINK, ms: 100 });
    act(() => { wrapped.removeNode('a'); });
    act(() => clock.advance(50));
    expect(() => wrapped.insertNode({ id: 'a', pose: { x: 5, y: 5, width: 30, height: 30 } })).not.toThrow();
    expect(initial.get('a')).toEqual({ x: 5, y: 5, width: 30, height: 30 });
  });

  it('can remove a node again after a removal whose tween threw', () => {
    const clock = makeClock();
    const initial = new Map<string, RectPose>([['a', { x: 0, y: 0, width: 20, height: 20 }]]);
    const { base, removeNode } = makeAdapter(initial);
    const { result } = renderHook(() => useAnimator(clock));
    const geometry = { ...NO_LERP } as never;
    const wrapped = animateLifecycle(base, result.current, { exitTo: SHRINK, ms: 100, geometry });
    expect(() => wrapped.removeNode('a')).toThrow(/lerp/);
    expect(() => wrapped.removeNode('a')).toThrow(/lerp/);
    expect(removeNode).not.toHaveBeenCalled();
  });

  it('leaves a node at the pose it was inserted with when its enter tween throws', () => {
    const clock = makeClock();
    const initial = new Map<string, RectPose>();
    const { base } = makeAdapter(initial);
    const { result } = renderHook(() => useAnimator(clock));
    const geometry = { ...NO_LERP } as never;
    const wrapped = animateLifecycle(base, result.current, { enterFrom: SHRINK, ms: 100, geometry });
    expect(() => wrapped.insertNode({ id: 'a', pose: { x: 0, y: 0, width: 20, height: 20 } })).toThrow(/lerp/);
    expect(initial.get('a')).toEqual({ x: 0, y: 0, width: 20, height: 20 });
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

describe('animateLifecycle under prefers-reduced-motion', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('enters and leaves at once in place of the default duration', () => {
    stubReducedMotion(true);
    const clock = makeClock();
    const initial = new Map<string, RectPose>();
    const { base, removeNode } = makeAdapter(initial);
    const { result } = renderHook(() => useAnimator(clock));
    const SHRINK = (p: RectPose) => ({ ...p, width: 0, height: 0 });
    const wrapped = animateLifecycle(base, result.current, { enterFrom: SHRINK, exitTo: SHRINK });
    act(() => { wrapped.insertNode({ id: 'a', pose: { x: 0, y: 0, width: 20, height: 20 } }); });
    act(() => clock.advance(0));
    act(() => clock.advance(16));
    expect(initial.get('a')!.width).toBe(20);
    act(() => { wrapped.removeNode('a'); });
    act(() => clock.advance(16));
    act(() => clock.advance(16));
    expect(removeNode).toHaveBeenCalledWith('a');
  });
});

import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { linear } from '@weasel-js/geom';
import { tweenPose } from '../../animation/poseHelpers';
import { useAnimator } from '../../animation/useAnimator';
import { arrayAdapter, type ArrayPoseTargets } from './arrayAdapter';
import { useArrayAdapter } from './useArrayAdapter';

type Box = { id: string; x: number; y: number; width: number; height: number };
type Pose = Omit<Box, 'id'>;

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

const toPose = ({ x, y, width, height }: Box): Pose => ({ x, y, width, height });
const at = (x: number): Pose => ({ x, y: 0, width: 10, height: 10 });

/** One box at x = 0 in an array the test owns, written synchronously. */
function setup(poseTargets?: ArrayPoseTargets<Pose>) {
  const clock = makeClock();
  const { result } = renderHook(() => useAnimator(clock));
  const ref = { current: [{ id: 'a', ...at(0) }] as Box[] };
  const setItems = (u: (items: Box[]) => Box[]): void => { ref.current = u(ref.current); };
  const build = () => arrayAdapter<Box, Pose>({ ref, setItems, toPose, poseTargets });
  const adapter = build();
  const x = (): number => ref.current[0]!.x;
  return { clock, animator: result.current, adapter, build, x };
}

describe('arrayAdapter.poseTarget', () => {
  it('answers one target per node, and none for an id it does not hold', () => {
    const { adapter } = setup();
    expect(adapter.poseTarget!('a')).toBeDefined();
    expect(adapter.poseTarget!('a')).toBe(adapter.poseTarget!('a'));
    expect(adapter.poseTarget!('nope')).toBeUndefined();
  });

  it('adds a second tweenPose to the first, where it used to replace it', () => {
    const { clock, animator, adapter, x } = setup();
    tweenPose(animator, adapter, { id: 'a', to: at(100), ms: 1000, easing: linear });
    clock.advance(0);
    clock.advance(500);
    expect(x()).toBeCloseTo(50, 6);
    tweenPose(animator, adapter, { id: 'a', to: at(200), ms: 1000, easing: linear });
    expect(x()).toBeCloseTo(50, 6);
    clock.advance(0);
    clock.advance(500);
    // The first has arrived at 100; the second is halfway through its own 100.
    expect(x()).toBeCloseTo(150, 6);
    clock.advance(500);
    clock.advance(16);
    expect(x()).toBe(200);
    expect(animator.isActive()).toBe(false);
  });

  it('leaves the array at the pose on screen when a move is canceled', () => {
    const { clock, animator, adapter, x } = setup();
    tweenPose(animator, adapter, { id: 'a', to: at(100), ms: 1000, easing: linear });
    clock.advance(0);
    clock.advance(250);
    animator.cancelKey('pose:a');
    clock.advance(16);
    expect(x()).toBeCloseTo(25, 6);
    expect(adapter.getPose('a').x).toBeCloseTo(25, 6);
  });

  it('keeps a node on one target across adapters given the same poseTargets', () => {
    const poseTargets: ArrayPoseTargets<Pose> = new Map();
    const { adapter, build } = setup(poseTargets);
    expect(adapter.poseTarget!('a')).toBeDefined();
    expect(build().poseTarget!('a')).toBe(adapter.poseTarget!('a'));
  });

  it('forgets the target of a node that left the array while it moved', () => {
    const { clock, animator, adapter } = setup();
    const before = adapter.poseTarget!('a');
    tweenPose(animator, adapter, { id: 'a', to: at(100), ms: 100, easing: linear });
    adapter.removeNode('a');
    clock.advance(0);
    clock.advance(200);
    clock.advance(16);
    adapter.insertNode({ id: 'a', ...at(0) });
    expect(adapter.poseTarget!('a')).not.toBe(before);
  });
});

describe('useArrayAdapter', () => {
  it('keeps a node on one target from render to render', () => {
    const { result, rerender } = renderHook(() => {
      const [items, setItems] = useState<Box[]>([{ id: 'a', ...at(0) }]);
      return useArrayAdapter<Box, Pose>({ items, setItems, toPose });
    });
    const first = result.current.poseTarget!('a');
    expect(first).toBeDefined();
    act(() => { result.current.setPose('a', at(5)); });
    rerender();
    expect(result.current.poseTarget!('a')).toBe(first);
    expect(first!.read().x).toBe(5);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAnimator } from './useAnimator';
import { tweenPose } from './poseHelpers';
import type { Op } from '../core/ops/types';

interface RectPose { x: number; y: number; width: number; height: number }
interface Obj { id: string }

function makeAdapter(initial: Map<string, RectPose>) {
  const ops: { ops: Op[]; label: string }[] = [];
  const adapter = {
    getObjects: () => [],
    getObject: (id: string): Obj | undefined => (initial.has(id) ? { id } : undefined),
    getSelection: () => [],
    hitTest: () => null,
    getPose: (id: string) => initial.get(id)!,
    getParent: () => null,
    setPose: vi.fn((id: string, pose: RectPose) => {
      initial.set(id, pose);
    }),
    setParent: () => {},
    insertObject: () => {},
    removeObject: () => {},
    setSelection: () => {},
    applyBatch: vi.fn((batch: Op[], label: string) => {
      ops.push({ ops: batch, label });
    }),
  };
  return { adapter, ops };
}

function makeClock() {
  let now = 0;
  const cbs = new Map<number, (t: number) => void>();
  let h = 1;
  return {
    now: () => now,
    requestFrame: (cb: (t: number) => void) => { const id = h++; cbs.set(id, cb); return id; },
    cancelFrame: (id: number) => cbs.delete(id),
    advance: (dt: number) => {
      now += dt;
      const due = Array.from(cbs.values());
      cbs.clear();
      for (const cb of due) cb(now);
    },
  };
}

describe('tweenPose', () => {
  it('records one transform op at start, then writes through setPose per frame', () => {
    const clock = makeClock();
    const initial = new Map<string, RectPose>([['a', { x: 0, y: 0, width: 10, height: 10 }]]);
    const { adapter, ops } = makeAdapter(initial);
    const { result } = renderHook(() => useAnimator(clock));
    act(() => {
      tweenPose(result.current, adapter as never, {
        id: 'a',
        to: { x: 100, y: 0, width: 10, height: 10 },
        ms: 100,
      });
    });
    expect(ops).toHaveLength(1);
    expect(ops[0].ops).toHaveLength(1);
    act(() => clock.advance(0));
    act(() => clock.advance(50));
    act(() => clock.advance(50));
    const last = adapter.setPose.mock.calls[adapter.setPose.mock.calls.length - 1][1];
    expect(last.x).toBeCloseTo(100, 1);
    // No additional op batches recorded for in-flight frames.
    expect(ops).toHaveLength(1);
  });

  it('recordOp: false skips the op emit', () => {
    const clock = makeClock();
    const initial = new Map<string, RectPose>([['a', { x: 0, y: 0, width: 10, height: 10 }]]);
    const { adapter, ops } = makeAdapter(initial);
    const { result } = renderHook(() => useAnimator(clock));
    act(() => {
      tweenPose(result.current, adapter as never, {
        id: 'a',
        to: { x: 5, y: 0, width: 10, height: 10 },
        ms: 50,
        recordOp: false,
      });
    });
    expect(ops).toHaveLength(0);
  });

  it('cancelKey collisions cancel the prior tween (new tween starts from current value)', () => {
    const clock = makeClock();
    const initial = new Map<string, RectPose>([['a', { x: 0, y: 0, width: 10, height: 10 }]]);
    const { adapter } = makeAdapter(initial);
    const { result } = renderHook(() => useAnimator(clock));
    act(() => {
      tweenPose(result.current, adapter as never, {
        id: 'a',
        to: { x: 100, y: 0, width: 10, height: 10 },
        ms: 1000,
      });
    });
    act(() => clock.advance(0));
    act(() => clock.advance(100)); // partial progress
    const midX = adapter.setPose.mock.calls[adapter.setPose.mock.calls.length - 1][1].x;
    act(() => {
      tweenPose(result.current, adapter as never, {
        id: 'a',
        to: { x: 0, y: 0, width: 10, height: 10 },
        ms: 100,
      });
    });
    act(() => clock.advance(0));
    // First frame of the second tween emits the live current pose (~midX),
    // not 0.
    const firstOfSecond = adapter.setPose.mock.calls[adapter.setPose.mock.calls.length - 1][1].x;
    expect(firstOfSecond).toBeCloseTo(midX, 1);
  });
});

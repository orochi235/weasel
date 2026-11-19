import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAnimator } from '@weasel-js/animator/react';
import { momentum } from './momentum';
import type { GestureContext } from 'interactions/gestures/types';
import { moveEnd } from 'interactions/actions/testUtils';
import type { Op } from 'core/ops/types';

interface RectPose { x: number; y: number; width: number; height: number }

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

const box = (x: number, y: number): RectPose => ({ x, y, width: 10, height: 10 });

describe("momentum — boundary: 'stop' over an adapter with no pose targets", () => {
  it('stops each node where it meets an edge, while the others travel on', () => {
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    const beh = momentum<RectPose>({
      animator: result.current, threshold: 0, friction: 0.92, now: clock.now,
      bounds: { x: 0, y: 0, width: 100, height: 1000 },
    });
    const poses = new Map<string, RectPose>([['a', box(95, 0)], ['b', box(0, 0)]]);
    const applyOps = vi.fn((_ops: Op[], _label: string) => {});
    const ctx: GestureContext<RectPose> = {
      draggedIds: ['a', 'b'],
      origin: new Map(poses),
      current: new Map(poses),
      snap: null,
      modifiers: { shift: false, alt: false, ctrl: false, meta: false },
      pointer: { worldX: 0, worldY: 0, clientX: 0, clientY: 0 },
      view: null,
      adapter: {
        getNode: (id: string) => (poses.has(id) ? { id } : undefined),
        getNodes: () => [...poses.keys()].map((id) => ({ id })),
        getPose: (id: string) => poses.get(id)!,
        getParent: () => null,
        setPose: (id: string, p: RectPose) => { poses.set(id, p); },
        setParent: () => {},
        applyOps,
      } as never,
      scratch: {},
    };
    beh.onStart?.(ctx);
    beh.onMove?.(ctx, { kind: 'translate', dx: 0, dy: 0 });
    clock.advance(16);
    ctx.pointer = { worldX: 2, worldY: 2, clientX: 2, clientY: 2 };
    beh.onMove?.(ctx, { kind: 'translate', dx: 0, dy: 0 });
    beh.onEnd?.(ctx, moveEnd());
    const ys: number[] = [];
    for (let i = 0; i < 40; i++) {
      clock.advance(16);
      if (poses.get('a')!.x === 100) ys.push(poses.get('a')!.y);
    }
    expect(ys.length).toBeGreaterThan(1);
    expect(new Set(ys).size).toBe(1);
    expect(poses.get('b')!.y).toBeGreaterThan(ys[0]!);
  });
});

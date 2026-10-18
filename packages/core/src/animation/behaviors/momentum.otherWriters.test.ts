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

/** Flick `ids` to the right over a scene that really stores their poses. */
function flick(ids: string[]) {
  const clock = makeClock();
  const { result } = renderHook(() => useAnimator(clock));
  const beh = momentum<RectPose>({ animator: result.current, threshold: 0, friction: 0.92, now: clock.now });
  const poses = new Map<string, RectPose>(ids.map((id) => [id, { x: 0, y: 0, width: 10, height: 10 }]));
  const writes = vi.fn((id: string, p: RectPose) => { poses.set(id, p); });
  const applyOps = vi.fn((_ops: Op[], _label: string) => {});
  const ctx: GestureContext<RectPose> = {
    draggedIds: ids,
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
      setPose: writes,
      setParent: () => {},
      applyOps,
    } as never,
    scratch: {},
  };
  beh.onStart?.(ctx);
  beh.onMove?.(ctx, { kind: 'translate', dx: 0, dy: 0 });
  clock.advance(16);
  ctx.pointer = { worldX: 20, worldY: 0, clientX: 20, clientY: 0 };
  beh.onMove?.(ctx, { kind: 'translate', dx: 0, dy: 0 });
  for (const id of ids) {
    poses.set(id, { x: 20, y: 0, width: 10, height: 10 });
    ctx.current.set(id, poses.get(id)!);
  }
  beh.onEnd?.(ctx, moveEnd());
  clock.advance(16);
  clock.advance(16);
  const settle = (): void => {
    for (let i = 0; i < 2000 && result.current.isActive(); i++) clock.advance(100);
  };
  const opIds = (): string[] =>
    applyOps.mock.calls.flatMap((call) => call[0].map((op) => (op.args as { id: string }).id));
  return { clock, animator: result.current, poses, writes, applyOps, settle, opIds };
}

describe('momentum — a coast gives way to another writer', () => {
  it('stops, with nothing recorded, when its node is deleted', () => {
    const { clock, animator, poses, writes, applyOps } = flick(['a']);
    expect(animator.isActive()).toBe(true);
    poses.delete('a');
    writes.mockClear();
    clock.advance(16);
    expect(animator.isActive()).toBe(false);
    expect(writes).not.toHaveBeenCalled();
    expect(applyOps).not.toHaveBeenCalled();
  });

  it('stops, and leaves the pose alone, when something else moves its node', () => {
    const { clock, animator, poses, writes, applyOps } = flick(['a']);
    const undone = { x: 0, y: 0, width: 10, height: 10 };
    poses.set('a', undone);
    writes.mockClear();
    clock.advance(16);
    expect(animator.isActive()).toBe(false);
    expect(poses.get('a')).toEqual(undone);
    expect(writes).not.toHaveBeenCalled();
    expect(applyOps).not.toHaveBeenCalled();
  });

  it('carries on with the nodes nobody else touched, and records only those', () => {
    const { clock, animator, poses, settle, opIds } = flick(['a', 'b']);
    poses.delete('a');
    clock.advance(16);
    expect(animator.isActive()).toBe(true);
    const before = poses.get('b')!.x;
    clock.advance(16);
    expect(poses.get('b')!.x).toBeGreaterThan(before);
    settle();
    expect(poses.has('a')).toBe(false);
    expect(opIds()).toEqual(['b']);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAnimator } from '@weasel-js/animator/react';
import { momentum, type MomentumOptions } from './momentum';
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
function flick(ids: string[], opts: Partial<MomentumOptions> = {}, start: (id: string) => number = () => 0, rise = 0) {
  const clock = makeClock();
  const { result } = renderHook(() => useAnimator(clock));
  const beh = momentum<RectPose>({ animator: result.current, threshold: 0, friction: 0.92, now: clock.now, ...opts });
  const poses = new Map<string, RectPose>(ids.map((id) => [id, { x: start(id), y: 0, width: 10, height: 10 }]));
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
  ctx.pointer = { worldX: 20, worldY: rise, clientX: 20, clientY: rise };
  beh.onMove?.(ctx, { kind: 'translate', dx: 0, dy: 0 });
  for (const id of ids) {
    poses.set(id, { x: start(id) + 20, y: rise, width: 10, height: 10 });
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
  it('records the flick where it stopped when the animator cancels it from outside', () => {
    const { clock, animator, poses, applyOps, opIds } = flick(['a']);
    clock.advance(16);
    const stood = poses.get('a')!.x;
    expect(stood).toBeGreaterThan(20);
    animator.cancelAll();
    expect(opIds()).toEqual(['a']);
    expect(applyOps.mock.calls[0]![1]).toBe('flick');
    expect((applyOps.mock.calls[0]![0][0]!.args as { to: { x: number } }).to.x).toBeCloseTo(stood);
  });
  it('under boundary: stop, halts each node at its own edge while the others travel on', () => {
    // `b` starts 100 to the right of `a`, so it reaches the edge at 200 while `a` is far from it.
    const { clock, poses, settle } = flick(
      ['a', 'b'], { bounds: { x: 0, y: -1000, width: 200, height: 2000 } }, (id) => (id === 'b' ? 100 : 0), 10,
    );
    for (let i = 0; i < 400 && poses.get('b')!.x < 200; i++) clock.advance(16);
    expect(poses.get('b')!.x).toBe(200);
    const bThen = poses.get('b')!.y;
    const aThen = poses.get('a')!.x;
    clock.advance(16);
    clock.advance(16);
    // b stopped at the edge, not sliding down along it; a, short of any edge, travels on.
    expect(poses.get('b')).toMatchObject({ x: 200, y: bThen });
    expect(poses.get('a')!.x).toBeGreaterThan(aThen);
    settle();
    expect(poses.get('b')).toMatchObject({ x: 200, y: bThen });
  });
});

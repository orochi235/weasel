import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAnimator } from '@weasel-js/animator/react';
import { momentum } from './momentum';
import type { GestureContext } from 'interactions/gestures/types';
import { moveEnd } from 'interactions/actions/testUtils';
import type { Op } from 'core/ops/types';
import { circle, CIRCLE_POSE_DESCRIPTOR, type CirclePose } from 'core/geometry/circlePose.fixture';

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

function makeCtx(initialPose: RectPose, setPose: (id: string, p: RectPose) => void): GestureContext<RectPose> {
  return {
    draggedIds: ['a'],
    origin: new Map([['a', { ...initialPose }]]),
    current: new Map([['a', { ...initialPose }]]),
    snap: null,
    modifiers: { shift: false, alt: false, ctrl: false, meta: false },
    pointer: { worldX: 0, worldY: 0, clientX: 0, clientY: 0 },
    view: null,
    adapter: {
      getNode: () => ({ id: 'a' }),
      getNodes: () => [{ id: 'a' }],
      getPose: () => initialPose,
      getParent: () => null,
      getChildren: () => [],
      setPose: (id: string, p: RectPose) => { setPose(id, p); },
      setParent: () => {},
    },
    scratch: {},
  };
}

describe('momentum', () => {
  it('records pointer samples on each onMove', () => {
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    const beh = momentum<RectPose>({ animator: result.current });
    const setPose = vi.fn();
    const ctx = makeCtx({ x: 0, y: 0, width: 10, height: 10 }, setPose);
    beh.onStart?.(ctx);
    ctx.pointer = { worldX: 10, worldY: 0, clientX: 10, clientY: 0 };
    beh.onMove?.(ctx, { kind: 'translate', dx: 0, dy: 0 });
    ctx.pointer = { worldX: 20, worldY: 0, clientX: 20, clientY: 0 };
    beh.onMove?.(ctx, { kind: 'translate', dx: 0, dy: 0 });
    const samples = ctx.scratch['momentum.samples'] as { x: number; y: number }[];
    expect(samples.map((s) => s.x)).toEqual([0, 10, 20]);
  });

  it('suppresses default commit and fires decay when release velocity exceeds threshold', () => {
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    const decaySpy = vi.spyOn(result.current, 'decay');
    const beh = momentum<RectPose>({ animator: result.current, threshold: 0, now: clock.now });
    const setPose = vi.fn();
    const ctx = makeCtx({ x: 0, y: 0, width: 10, height: 10 }, setPose);
    beh.onStart?.(ctx);
    // Two samples 16ms apart at +10px each → ~625 px/sec
    ctx.pointer = { worldX: 0, worldY: 0, clientX: 0, clientY: 0 };
    beh.onMove?.(ctx, { kind: 'translate', dx: 0, dy: 0 });
    clock.advance(16);
    ctx.pointer = { worldX: 10, worldY: 0, clientX: 10, clientY: 0 };
    beh.onMove?.(ctx, { kind: 'translate', dx: 0, dy: 0 });
    clock.advance(16);
    ctx.pointer = { worldX: 20, worldY: 0, clientX: 20, clientY: 0 };
    beh.onMove?.(ctx, { kind: 'translate', dx: 0, dy: 0 });
    const ops = beh.onEnd?.(ctx, moveEnd());
    expect(ops).toBeNull(); // suppress default commit
    expect(decaySpy).toHaveBeenCalledTimes(1);
  });

  it('returns undefined (defer to default) when release velocity is below threshold', () => {
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    const decaySpy = vi.spyOn(result.current, 'decay');
    const beh = momentum<RectPose>({ animator: result.current, threshold: 10000 });
    const setPose = vi.fn();
    const ctx = makeCtx({ x: 0, y: 0, width: 10, height: 10 }, setPose);
    beh.onStart?.(ctx);
    beh.onMove?.(ctx, { kind: 'translate', dx: 0, dy: 0 });
    const ops = beh.onEnd?.(ctx, moveEnd());
    expect(ops).toBeUndefined();
    expect(decaySpy).not.toHaveBeenCalled();
  });
  it('clamps the per-tick position to bounds and stops on edge hit', () => {
    // Regression: without bounds, a hard flick carries the card thousands
    // of pixels offscreen before friction settles velocity. With bounds and
    // policy='stop', the decay cancels as soon as the clamped position
    // pegs the boundary on every dragged id.
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    const setPose = vi.fn();
    const ctx = makeCtx({ x: 0, y: 0, width: 10, height: 10 }, setPose);
    const beh = momentum<RectPose>({
      animator: result.current,
      friction: 0.9,
      bounds: { x: 0, y: 0, width: 100, height: 100 },
      now: clock.now,
    });
    beh.onStart?.(ctx);
    // Three samples 50ms apart, 50px right each → vx = 1000 px/s with both
    // a sample at the cutoff boundary and one at the latest moment for the
    // velocity calculation to compute a non-zero dt.
    clock.advance(50);
    ctx.pointer = { worldX: 50, worldY: 0, clientX: 50, clientY: 0 };
    beh.onMove?.(ctx, { kind: 'translate', dx: 0, dy: 0 });
    clock.advance(50);
    ctx.pointer = { worldX: 100, worldY: 0, clientX: 100, clientY: 0 };
    beh.onMove?.(ctx, { kind: 'translate', dx: 0, dy: 0 });
    const ops = beh.onEnd?.(ctx, moveEnd());
    // onEnd should have suppressed the default commit (returned null) and
    // queued a decay that calls setPose ≥ once on its first tick.
    expect(ops).toBeNull();
    // Drive frames so the decay ticks.
    for (let i = 0; i < 20; i++) clock.advance(16);
    // Some setPose calls happened; the final position is clamped at x ≤ 100.
    expect(setPose.mock.calls.length).toBeGreaterThan(0);
    const lastCall = setPose.mock.calls[setPose.mock.calls.length - 1];
    const finalPose = lastCall[1] as RectPose;
    expect(finalPose.x).toBeLessThanOrEqual(100);
    // Decay canceled or finished — no animations active.
    expect(result.current.isActive()).toBe(false);
  });
});

describe('momentum — the committed flick', () => {
  function flick(friction: number) {
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    const beh = momentum<RectPose>({ animator: result.current, threshold: 0, friction, now: clock.now });
    const setPose = vi.fn();
    const applyOps = vi.fn((_ops: Op[], _label: string) => {});
    const ctx = makeCtx({ x: 0, y: 0, width: 10, height: 10 }, setPose);
    (ctx.adapter as { applyOps?: typeof applyOps }).applyOps = applyOps;
    beh.onStart?.(ctx);
    beh.onMove?.(ctx, { kind: 'translate', dx: 0, dy: 0 });
    clock.advance(16);
    ctx.pointer = { worldX: 20, worldY: 0, clientX: 20, clientY: 0 };
    beh.onMove?.(ctx, { kind: 'translate', dx: 0, dy: 0 });
    ctx.current.set('a', { x: 20, y: 0, width: 10, height: 10 });
    beh.onEnd?.(ctx, moveEnd());
    return { clock, animator: result.current, beh, setPose, applyOps, ctx };
  }

  it('records the transform from where the drag began, not from the release point', () => {
    const { clock, animator, applyOps } = flick(1e-9);
    for (let i = 0; i < 100 && animator.isActive(); i++) clock.advance(100);
    expect(animator.isActive()).toBe(false);
    expect(applyOps).toHaveBeenCalledTimes(1);
    const args = applyOps.mock.calls[0]![0][0]!.args as { from: RectPose; to: RectPose };
    expect(args.from.x).toBe(0);
    expect(args.to.x).toBeGreaterThan(20);
  });

  it('a new drag of a coasting node stops the coast and commits it where it stands', () => {
    const { clock, animator, beh, setPose, applyOps, ctx } = flick(0.92);
    clock.advance(16);
    clock.advance(16);
    expect(animator.isActive()).toBe(true);
    const stoodAt = (setPose.mock.calls[setPose.mock.calls.length - 1]![1] as RectPose).x;

    const next = makeCtx({ x: stoodAt, y: 0, width: 10, height: 10 }, setPose);
    beh.onStart?.(next);
    expect(animator.isActive()).toBe(false);
    expect(applyOps).toHaveBeenCalledTimes(1);
    const args = applyOps.mock.calls[0]![0][0]!.args as { from: RectPose; to: RectPose };
    expect(args.to.x).toBe(stoodAt);

    const writes = setPose.mock.calls.length;
    for (let i = 0; i < 5; i++) clock.advance(16);
    expect(setPose.mock.calls.length).toBe(writes);
    expect(ctx.draggedIds).toEqual(['a']);
  });

  it('a drag of another node leaves the coast running', () => {
    const { clock, animator, beh, setPose } = flick(0.92);
    clock.advance(16);
    const other = makeCtx({ x: 0, y: 0, width: 10, height: 10 }, setPose);
    other.draggedIds = ['b'];
    beh.onStart?.(other);
    expect(animator.isActive()).toBe(true);
  });
});

describe('momentum — non-rect poses', () => {
  it('flicks a circle through its descriptor', () => {
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    const beh = momentum<CirclePose>({
      animator: result.current, threshold: 0, now: clock.now,
      poseDescriptor: CIRCLE_POSE_DESCRIPTOR,
    });
    const written: CirclePose[] = [];
    const ctx = makeCtx(circle(0, 0, 5) as never, (_id, p) => { written.push(p as never); }) as unknown as GestureContext<CirclePose>;
    beh.onStart?.(ctx);
    ctx.pointer = { worldX: 0, worldY: 0, clientX: 0, clientY: 0 };
    beh.onMove?.(ctx, { kind: 'translate', dx: 0, dy: 0 });
    clock.advance(16);
    ctx.pointer = { worldX: 10, worldY: 0, clientX: 10, clientY: 0 };
    beh.onMove?.(ctx, { kind: 'translate', dx: 0, dy: 0 });
    beh.onEnd?.(ctx, moveEnd());
    // The decay's first tick emits `from` unmoved — it only seeds the clock —
    // so the flick shows up from the second frame on.
    clock.advance(16);
    clock.advance(16);
    expect(written.length).toBeGreaterThan(0);
    expect(Object.keys(written[0]!).sort()).toEqual(['cx', 'cy', 'r']);
    expect(written[written.length - 1]!.cx).toBeGreaterThan(0);
  });
});

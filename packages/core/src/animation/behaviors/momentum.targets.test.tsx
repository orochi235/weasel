import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createScene } from '../../core/scene/scene';
import { effectivePose } from '../../core/scene/effectivePose';
import type { RectPose } from '../../core/scene/types';
import { moveGestureAdapter } from '../../interactions/actions/move/gestureAdapter';
import type { GestureContext } from 'interactions/gestures/types';
import { moveEnd } from 'interactions/actions/testUtils';
import { tweenPose } from '../poseHelpers';
import { scenePoseTarget } from '../poseTarget';
import { useAnimator } from '@weasel-js/animator/react';
import { momentum, type MomentumOptions } from './momentum';

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

const at = (x: number, y = 0): RectPose => ({ x, y, width: 10, height: 10 });

/** Drag `a` from 0 to 20 over a real scene, then release it moving at (`vx`, `vy`) a second. */
function flick(opts: Partial<MomentumOptions> = {}, vx = 1250, vy = 0) {
  const clock = makeClock();
  const { result } = renderHook(() => useAnimator(clock));
  const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const a = scene.add({ kind: 'leaf', layer: 'main', pose: at(0), data: {} });
  const adapter = moveGestureAdapter(scene, (ops, label, self) => scene.applyBatch(ops, label, self));
  const beh = momentum<RectPose>({ animator: result.current, threshold: 0, friction: 0.5, now: clock.now, ...opts });
  const ctxFor = (origin: RectPose, current: RectPose): GestureContext<RectPose> => ({
    draggedIds: [a],
    origin: new Map([[a, origin]]),
    current: new Map([[a, current]]),
    snap: null,
    modifiers: { shift: false, alt: false, ctrl: false, meta: false },
    pointer: { worldX: 0, worldY: 0, clientX: 0, clientY: 0 },
    view: null,
    adapter: adapter as never,
    scratch: {},
  });
  const ctx = ctxFor(at(0), at(20));
  beh.onStart?.(ctx);
  beh.onMove?.(ctx, { kind: 'translate', dx: 0, dy: 0 });
  clock.advance(16);
  ctx.pointer = { worldX: vx * 0.016, worldY: vy * 0.016, clientX: 0, clientY: 0 };
  beh.onMove?.(ctx, { kind: 'translate', dx: 0, dy: 0 });
  const entries = scene.historyEntries().length;
  const answer = beh.onEnd?.(ctx, moveEnd());
  const shown = () => effectivePose(scene, scene.get(a)!);
  const settle = (): void => {
    for (let i = 0; i < 4000 && result.current.isActive(); i++) clock.advance(16);
    clock.advance(16);
  };
  return { clock, animator: result.current, scene, a, beh, ctxFor, shown, settle, entries, answer };
}

describe('momentum over a scene', () => {
  it('coasts on the node on screen and leaves the document where the drag began', () => {
    const { clock, animator, scene, a, shown, answer } = flick();
    expect(answer).toBeNull();
    expect(shown().x).toBeCloseTo(20);
    clock.advance(16);
    clock.advance(16);
    expect(animator.isActive()).toBe(true);
    expect(shown().x).toBeGreaterThan(20);
    expect(scene.get(a)!.pose.x).toBe(0);
    // The coast is on the node's own pose target, where anything else animating the node adds.
    expect(scenePoseTarget(scene, a)!.active).toBe(true);
  });

  it('records the whole flick as one step once it comes to rest', () => {
    const { scene, a, shown, settle, entries } = flick();
    settle();
    const rest = scene.get(a)!.pose.x;
    expect(rest).toBeGreaterThan(100);
    expect(shown().x).toBe(rest);
    expect(scene.overrides.has(a)).toBe(false);
    expect(scene.historyEntries().length).toBe(entries + 1);
    scene.undo();
    expect(scene.get(a)!.pose.x).toBe(0);
    scene.redo();
    expect(scene.get(a)!.pose.x).toBe(rest);
  });

  it('stops at the edge of its bounds', () => {
    const { animator, scene, a, clock } = flick({ bounds: { x: 0, y: 0, width: 100, height: 100 } });
    for (let i = 0; i < 20; i++) clock.advance(16);
    expect(animator.isActive()).toBe(false);
    expect(scene.get(a)!.pose.x).toBe(100);
  });

  it('slides along an edge under boundary: continue', () => {
    const { scene, a, clock, settle, shown } = flick(
      { bounds: { x: 0, y: 0, width: 100, height: 10000 }, boundary: 'continue' }, 1250, 1250,
    );
    for (let i = 0; i < 20; i++) clock.advance(16);
    const y = shown().y;
    expect(shown().x).toBe(100);
    clock.advance(16);
    expect(shown().y).toBeGreaterThan(y);
    settle();
    expect(scene.get(a)!.pose.x).toBe(100);
    expect(scene.get(a)!.pose.y).toBeGreaterThan(y);
  });

  it('drops out where another writer left the node, and records nothing', () => {
    const { clock, animator, scene, a, shown, entries } = flick();
    clock.advance(16);
    clock.advance(16);
    scene.setPose(a, at(5));
    clock.advance(16);
    clock.advance(16);
    expect(animator.isActive()).toBe(false);
    expect(scene.get(a)!.pose.x).toBe(5);
    expect(shown().x).toBe(5);
    expect(scene.historyEntries().length).toBe(entries + 1);
  });

  it('springs what it had left to nothing when a tweenPose takes the node, so the node does not jump', () => {
    const { clock, animator, scene, a, shown, settle, entries } = flick();
    clock.advance(16);
    clock.advance(16);
    const before = shown().x;
    expect(before).toBeGreaterThan(20);
    const adapter = {
      getPose: (id: string) => scene.get(id as never)!.pose,
      setPose: (id: string, pose: RectPose) => scene.setPose(id as never, pose),
      poseTarget: (id: string) => scenePoseTarget(scene, id),
    };
    tweenPose(animator, adapter, { id: a, to: at(200), ms: 300, recordOp: false });
    expect(shown().x).toBeCloseTo(before);
    // Dropping out with what it had traveled would put the node back near 20 here.
    clock.advance(16);
    expect(shown().x).toBeGreaterThanOrEqual(before);
    clock.advance(16);
    expect(shown().x).toBeGreaterThan(before);
    settle();
    expect(scene.get(a)!.pose.x).toBe(200);
    expect(shown().x).toBe(200);
    expect(scene.overrides.has(a)).toBe(false);
    expect(scene.historyEntries().length).toBe(entries);
  });

  it('a new drag of the coasting node stops it and records it where it stands', () => {
    const { clock, animator, scene, a, beh, ctxFor, shown, entries } = flick();
    clock.advance(16);
    clock.advance(16);
    const stood = shown().x;
    beh.onStart?.(ctxFor(at(stood), at(stood)));
    expect(animator.isActive()).toBe(false);
    expect(scene.get(a)!.pose.x).toBeCloseTo(stood);
    expect(scene.historyEntries().length).toBe(entries + 1);
  });
});

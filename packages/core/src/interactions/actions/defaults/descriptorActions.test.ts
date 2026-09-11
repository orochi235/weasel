import { describe, it, expect } from 'vitest';
import { createScene } from 'core/scene/scene';
import type { NodeId, Scene } from 'core/scene/types';
import type { ImmediateInvoker, InvocationCtx } from '../invoker';
import { flipAction } from './flip';
import { nudgeRightAction } from './nudge';
import { alignLeftAction } from './align';
import { distributeHorizontalAction } from './distribute';
import { duplicateAction } from './duplicate';
import { cloneAction } from './clone';
import { rotateAction } from './rotate';
import { circle, CIRCLE_POSE_DESCRIPTOR, type CirclePose } from 'core/geometry/circlePose.fixture';

type S = Scene<object, 'main', CirclePose>;
const scene = (): S => createScene<object, 'main', CirclePose>({ systemLayers: [{ id: 'main' }] });
const leaf = (s: S, p: CirclePose) => s.add({ kind: 'leaf', layer: 'main', pose: p, data: {} });
const deps = (s: S, ids: NodeId[]) => ({
  selection: { get: () => ids, set: () => {} },
  scene: s as unknown as Scene<unknown, string, unknown>,
  poseDescriptor: CIRCLE_POSE_DESCRIPTOR,
});
const run = (action: { invoker?: unknown }, d: object, params?: object) =>
  (action.invoker as ImmediateInvoker).run(d as never, params as never);

describe('built-in actions read the poseDescriptor dep', () => {
  it('flip leaves a symmetric circle where it is', () => {
    const s = scene(); const a = leaf(s, circle(10, 10, 5));
    run(flipAction, deps(s, [a]), { axis: 'x' });
    expect(s.get(a)!.pose).toEqual(circle(10, 10, 5));
  });

  it('nudge moves a circle', () => {
    const s = scene(); const a = leaf(s, circle(10, 10, 5));
    run(nudgeRightAction, deps(s, [a]));
    expect(s.get(a)!.pose.cy).toBe(10);
    expect(s.get(a)!.pose.cx).toBeGreaterThan(10);
    expect(Object.keys(s.get(a)!.pose).sort()).toEqual(['cx', 'cy', 'r']);
  });

  it('align-left lines circles up on their left edges', () => {
    const s = scene(); const a = leaf(s, circle(10, 0, 5)); const b = leaf(s, circle(50, 40, 10));
    run(alignLeftAction, deps(s, [a, b]));
    expect(s.get(b)!.pose).toEqual(circle(15, 40, 10));
  });

  it('distribute spaces three circles evenly', () => {
    const s = scene();
    const a = leaf(s, circle(0, 0, 5)); const b = leaf(s, circle(20, 0, 5)); const c = leaf(s, circle(100, 0, 5));
    run(distributeHorizontalAction, deps(s, [a, b, c]));
    expect(s.get(b)!.pose).toEqual(circle(50, 0, 5));
  });

  it('duplicate offsets a circle through its descriptor', () => {
    const s = scene(); const a = leaf(s, circle(10, 10, 5));
    const d = deps(s, [a]);
    run(duplicateAction, d);
    const copy = [...s.nodes.values()].find((n) => n.id !== a)!;
    expect(Object.keys(copy.pose).sort()).toEqual(['cx', 'cy', 'r']);
    expect(Number.isFinite(copy.pose.cx)).toBe(true);
  });

  it('rotate leaves a pose that cannot rotate untouched', () => {
    const s = scene(); const a = leaf(s, circle(10, 10, 5));
    const invoker = rotateAction.invoker;
    if (!invoker || invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    const base = { world: { x: 30, y: 10 }, screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false }, deps: deps(s, [a]) };
    const h = invoker.start(base as unknown as InvocationCtx, undefined);
    // After the fix a non-rotatable selection gets an empty handle.
    h.onMove?.({ ...base, world: { x: 10, y: 30 } } as unknown as InvocationCtx);
    h.onEnd?.({ ...base, world: { x: 10, y: 30 } } as unknown as InvocationCtx, 'commit');
    expect(s.get(a)!.pose).toEqual(circle(10, 10, 5));
  });

  it('clone translates a circle', () => {
    const s = scene(); const a = leaf(s, circle(10, 10, 5));
    const invoker = cloneAction.invoker;
    if (!invoker || invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    const base = { world: { x: 0, y: 0 }, screen: { x: 0, y: 0 },
      modifiers: { alt: true, ctrl: false, meta: false, shift: false }, deps: deps(s, [a]) };
    const dragCtx = { start: { x: 0, y: 0 }, current: { x: 20, y: 0 }, delta: { x: 20, y: 0 } };
    const h = invoker.start(base as unknown as InvocationCtx, undefined);
    h.onMove!({ ...base, drag: dragCtx } as unknown as InvocationCtx);
    h.onEnd!({ ...base, drag: dragCtx } as unknown as InvocationCtx, 'commit');
    const copy = [...s.nodes.values()].find((n) => n.id !== a)!;
    expect(copy.pose).toEqual(circle(30, 10, 5));
  });
});

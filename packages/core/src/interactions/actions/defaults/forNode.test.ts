/**
 * Every action that writes a pose writes it through the node's own descriptor
 * (`PoseDescriptor.forNode`). The fixture's specialized descriptor stamps each
 * pose it produces, so a write through the unspecialized one shows.
 */
import { describe, expect, it } from 'vitest';
import type { Action, InvocationCtx } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import type { NodeId } from 'core/scene/types';
import { RECT_POSE_DESCRIPTOR, type PoseDescriptor } from 'core/geometry/poseDescriptor';
import type { SelectionApi } from 'core/selection/useSelection';
import { nudgeRightAction } from './nudge';
import { duplicateAction } from './duplicate';
import { cloneAction } from '../clone/action';
import { moveAction } from '../move/action';
import { rotateAction } from '../rotate/action';
import { resizeAction } from '../resize/action';

interface Pose { x: number; y: number; width: number; height: number; rotation?: number; via?: string }
interface PosedNode { data: { own: boolean } }

const rect = RECT_POSE_DESCRIPTOR as unknown as PoseDescriptor<Pose, PosedNode>;
const stamp = (p: Pose): Pose => ({ ...p, via: 'own' });
const OWN: PoseDescriptor<Pose, PosedNode> = {
  ...rect,
  translate: (p, dx, dy) => stamp(rect.translate!(p, dx, dy)),
  remapBounds: (p, src, dst) => stamp(rect.remapBounds(p, src, dst)),
  withRotation: (p, rotation) => stamp(rect.withRotation!(p, rotation)),
};
const DESCRIPTOR: PoseDescriptor<Pose, PosedNode> = { ...rect, forNode: (node) => (node.data.own ? OWN : DESCRIPTOR) };

function setup() {
  const scene = createScene<{ own: boolean }, 'main', Pose>({ systemLayers: [{ id: 'main' }] });
  const id = scene.add({ kind: 'mark', layer: 'main', data: { own: true }, pose: { x: 10, y: 10, width: 40, height: 20 } });
  let selected: NodeId[] = [id];
  const selection = {
    get: () => selected,
    set: (ids: NodeId[]) => { selected = ids; },
    adapterMethods: { getSelection: () => selected, setSelection: (ids: NodeId[]) => { selected = ids; } },
  } as unknown as SelectionApi;
  const deps = { scene, selection, poseDescriptor: DESCRIPTOR };
  const ctx = (world: { x: number; y: number }, drag?: InvocationCtx['drag']): InvocationCtx => ({
    world,
    screen: world,
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps,
    ...(drag ? { drag } : {}),
  } as unknown as InvocationCtx);
  /** Drag `action` from `from` to `to` and commit. */
  const drag = (action: Action, from: { x: number; y: number }, to: { x: number; y: number }, extra: object = {}): void => {
    if (action.invoker?.timing !== 'ongoing') throw new Error('expected an ongoing action');
    const d = { start: from, current: to, delta: { x: to.x - from.x, y: to.y - from.y }, ...extra };
    const handle = action.invoker.start(ctx(from, { ...d, current: from, delta: { x: 0, y: 0 } }), undefined);
    handle.onMove!(ctx(to, d));
    handle.onEnd!(ctx(to, d), 'commit');
  };
  const run = (action: Action): void => {
    if (action.invoker?.timing !== 'immediate') throw new Error('expected an immediate action');
    action.invoker.run(deps as never, undefined);
  };
  const poseOf = (node: NodeId): Pose => scene.get(node)!.pose;
  return { scene, id, drag, run, poseOf, selected: () => selected };
}

describe('pose writes go through the node\'s own descriptor', () => {
  it('nudge', () => {
    const { id, run, poseOf } = setup();
    run(nudgeRightAction);
    expect(poseOf(id).via).toBe('own');
  });

  it('duplicate', () => {
    const { run, poseOf, selected } = setup();
    run(duplicateAction);
    expect(poseOf(selected()[0]).via).toBe('own');
  });

  it('clone', () => {
    const { scene, id, drag, poseOf } = setup();
    drag(cloneAction, { x: 20, y: 20 }, { x: 60, y: 20 });
    const copy = [...scene.renderOrder()].find((n) => n !== id)!;
    expect(poseOf(copy)).toMatchObject({ x: 50, via: 'own' });
  });

  it('move', () => {
    const { id, drag, poseOf } = setup();
    drag(moveAction, { x: 20, y: 20 }, { x: 60, y: 20 });
    expect(poseOf(id)).toMatchObject({ x: 50, via: 'own' });
  });

  it('rotate', () => {
    const { id, drag, poseOf } = setup();
    drag(rotateAction, { x: 60, y: 20 }, { x: 30, y: 50 });
    expect(poseOf(id).rotation).toBeCloseTo(Math.PI / 2);
    expect(poseOf(id).via).toBe('own');
  });

  it('resize', () => {
    const { id, drag, poseOf } = setup();
    drag(resizeAction, { x: 50, y: 30 }, { x: 70, y: 40 }, {
      affordance: { kind: 'handle:bottom-right', fixedPoint: { x: 10, y: 10 }, targetIds: [id], anchor: { x: 'min', y: 'min' } },
    });
    expect(poseOf(id)).toMatchObject({ width: 60, height: 30, via: 'own' });
  });
});

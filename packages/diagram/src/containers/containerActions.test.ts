import { describe, expect, it } from 'vitest';
import {
  commitOps, createScene, scenePoseFrame, type ActionDeps, type ImmediateInvoker, type InvocationCtx, type NodeId, type OngoingHandle,
  type OngoingInvoker, type RectPose,
} from '@weasel-js/core';
import type { Vec2 } from '@weasel-js/core/math';
import { withDiagramRegistry } from '../edge';
import { CONTAINER_STENCILS, containerBuild, lanesOf } from './containerStencils';
import { createAddLaneAction, createLaneResizeAction, createReleaseMembersAction } from './containerActions';
import { createLaneAffordance, type LaneScratch } from './laneBoundaryLayer';

function pool() {
  const scene = createScene<Record<string, unknown>, 'main', RectPose>({ systemLayers: [{ id: 'main' }], registry: withDiagramRegistry() });
  let n = 0;
  const built = containerBuild(CONTAINER_STENCILS[1]!, { x: 0, y: 0, width: 480, height: 240 }, { layer: 'main', newId: () => `n${n++}` });
  commitOps({ scene } as unknown as ActionDeps, built.ops, 'Insert');
  const [first, second] = lanesOf(scene as never, built.id) as unknown as [string, string];
  // At (100, 150) in world, stored in the lane's frame.
  const at = scenePoseFrame(scene as never).localUnder(second as NodeId, { x: 100, y: 150, width: 40, height: 20 }) as RectPose;
  scene.add({ id: 'm' as NodeId, kind: 'mark', layer: 'main', parent: second as NodeId, pose: at, data: {} });
  return { scene, poolId: built.id, first, second };
}

const pose = (scene: ReturnType<typeof pool>['scene'], id: string) => scene.get(id as NodeId)!.pose;
const worldOf = (scene: ReturnType<typeof pool>['scene'], id: string) => scenePoseFrame(scene as never).world(id as NodeId) as RectPose;

describe('lane affordances', () => {
  it('offer a boundary after each lane and an add-lane button per pool', () => {
    const { scene, poolId, first, second } = pool();
    const regions = createLaneAffordance(scene as never).regions({} as never);
    expect(regions.map((r) => r.id)).toEqual([`${first}:boundary`, `${second}:boundary`, `${poolId}:add-lane`]);
  });
});

describe('the lane resize action', () => {
  function resize(h: ReturnType<typeof pool>, to: Vec2, during?: (handle: OngoingHandle) => void) {
    const action = createLaneResizeAction({ scene: h.scene as never });
    const payload: LaneScratch = { targetId: h.poolId, poolId: h.poolId, laneId: h.first };
    const ctx = (at: Vec2) => ({
      world: at, screen: at, modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: { scene: h.scene } as unknown as ActionDeps,
      drag: { start: { x: 200, y: 120 }, current: at, delta: { x: at.x - 200, y: at.y - 120 }, affordance: { kind: 'layer:diagram-lanes', payload } },
    }) as unknown as InvocationCtx;
    const handle = (action.invoker as OngoingInvoker).start(ctx({ x: 200, y: 120 }), undefined) as OngoingHandle;
    handle.onMove!(ctx(to));
    during?.(handle);
    handle.onEnd!(ctx(to), 'commit');
  }

  it('resizes the lane, moves the later lanes and what they hold, and grows the pool, in one entry', () => {
    const h = pool();
    const entries = h.scene.historyIndex();
    const stored = pose(h.scene, 'm');
    resize(h, { x: 200, y: 150 }, (handle) => {
      expect(handle.previewPose!(h.second)).toMatchObject({ y: 150 });
    });
    expect(pose(h.scene, h.first)).toMatchObject({ y: 0, height: 150 });
    expect(pose(h.scene, h.second)).toMatchObject({ y: 150, height: 120 });
    // The lane carries it, so its own pose is not written.
    expect(pose(h.scene, 'm')).toBe(stored);
    expect(worldOf(h.scene, 'm')).toMatchObject({ y: 180 });
    expect(pose(h.scene, h.poolId)).toMatchObject({ height: 270 });
    expect(h.scene.historyIndex()).toBe(entries + 1);
  });

  it('stops a lane at its least size', () => {
    const h = pool();
    resize(h, { x: 200, y: -500 });
    expect(pose(h.scene, h.first)).toMatchObject({ height: 40 });
    expect(pose(h.scene, h.second)).toMatchObject({ y: 40 });
  });
});

describe('the release members command', () => {
  it('is enabled for a selected container and releases it in one entry', () => {
    const h = pool();
    const nothing = createReleaseMembersAction({ scene: h.scene as never, selected: () => ['m'] });
    expect(nothing.enabled!({} as never)).not.toBe(true);
    const action = createReleaseMembersAction({ scene: h.scene as never, selected: () => [h.poolId] });
    expect(action.enabled!({} as never)).toBe(true);
    const entries = h.scene.historyIndex();
    (action.invoker as ImmediateInvoker).run({ scene: h.scene } as never, undefined);
    expect(h.scene.get(h.poolId as NodeId)).toBeUndefined();
    expect(h.scene.get('m' as NodeId)!.parent).toBeNull();
    expect(h.scene.historyIndex()).toBe(entries + 1);
  });
});

describe('the add-lane action', () => {
  it('adds a lane at the end of the stack for a press on the button', () => {
    const h = pool();
    const action = createAddLaneAction({ scene: h.scene as never });
    const affordance = { payload: { targetId: h.poolId, poolId: h.poolId } satisfies LaneScratch };
    (action.invoker as ImmediateInvoker).run({ scene: h.scene } as never, { worldX: 0, worldY: 0, affordance } as never);
    expect(lanesOf(h.scene as never, h.poolId)).toHaveLength(3);
    expect(pose(h.scene, h.poolId)).toMatchObject({ height: 360 });
  });
});

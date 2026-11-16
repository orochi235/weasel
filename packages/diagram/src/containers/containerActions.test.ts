import { describe, expect, it, vi } from 'vitest';
import {
  commitOps, createDispatcher, createScene, type Action, type ActionsRegistry, type DispatcherContext, type InputEvent, scenePoseFrame, type ActionDeps, type ImmediateInvoker, type InvocationCtx, type NodeId, type OngoingHandle,
  type OngoingInvoker, type RectPose,
} from '@weasel-js/core';
import type { Vec2 } from '@weasel-js/core/math';
import { withDiagramRegistry } from '../edge';
import { CONTAINER_STENCILS, containerBuild, lanesOf } from './containerStencils';
import { createAddLaneAction, createLaneResizeAction, createReleaseMembersAction, diagramContainers } from './containerActions';
import { createLaneAffordance, LANE_AFFORDANCE_KIND, LANE_LAYER_ID, type LaneScratch } from './laneBoundaryLayer';

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
    if (handle.onMove === undefined) return handle;
    handle.onMove(ctx(to));
    during?.(handle);
    handle.onEnd!(ctx(to), 'commit');
    return handle;
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

  it('offers no boundary, and hands the drag on, where the resize would write a locked lane or title', () => {
    for (const lock of ['first', 'second', 'firstTitle', 'poolTitle'] as const) {
      const h = pool();
      const id = { first: h.first, second: h.second, firstTitle: `${h.first}/title`, poolTitle: `${h.poolId}/title` }[lock];
      h.scene.setLocked(id as NodeId, true);
      const regions = createLaneAffordance(h.scene as never).regions({} as never).map((r) => r.id);
      expect(regions).not.toContain(`${h.first}:boundary`);
      const entries = h.scene.historyIndex();
      expect(resize(h, { x: 200, y: 150 })).toEqual({});
      expect(h.scene.historyIndex()).toBe(entries);
    }
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

  it('is disabled over a container holding a locked member, which it could not move', () => {
    const h = pool();
    h.scene.setLocked('m' as NodeId, true);
    const action = createReleaseMembersAction({ scene: h.scene as never, selected: () => [h.poolId] });
    expect(action.enabled!({} as never)).not.toBe(true);
    const entries = h.scene.historyIndex();
    expect(() => (action.invoker as ImmediateInvoker).run({ scene: h.scene } as never, undefined)).not.toThrow();
    expect(h.scene.get(h.poolId as NodeId)).toBeDefined();
    expect(h.scene.historyIndex()).toBe(entries);
  });
});

describe('the add-lane action', () => {
  it('adds a lane at the end of the stack for a press on the button', () => {
    const h = pool();
    const action = createAddLaneAction({ scene: h.scene as never });
    const affordance = { payload: { targetId: h.poolId, poolId: h.poolId } satisfies LaneScratch };
    (action.invoker as ImmediateInvoker).run({ scene: h.scene } as never, { world: { x: 0, y: 0 }, affordance } as never);
    expect(lanesOf(h.scene as never, h.poolId)).toHaveLength(3);
    expect(pose(h.scene, h.poolId)).toMatchObject({ height: 360 });
  });

  it('offers no button, and passes the press on, where the lane would grow a locked title', () => {
    const h = pool();
    h.scene.setLocked(`${h.poolId}/title` as NodeId, true);
    expect(createLaneAffordance(h.scene as never).regions({} as never).map((r) => r.id)).not.toContain(`${h.poolId}:add-lane`);
    const action = createAddLaneAction({ scene: h.scene as never });
    const affordance = { payload: { targetId: h.poolId, poolId: h.poolId } satisfies LaneScratch };
    const run = () => (action.invoker as ImmediateInvoker).run({ scene: h.scene } as never, { world: { x: 0, y: 0 }, affordance } as never);
    expect(run).not.toThrow();
    expect(run()).toBe('pass');
    expect(lanesOf(h.scene as never, h.poolId)).toHaveLength(2);
  });
});

describe('a press on a lane affordance, through the dispatcher', () => {
  /** The containers, and after them a click on a lane affordance that `next` hears. */
  function surface(h: ReturnType<typeof pool>) {
    const contribution = diagramContainers({ scene: h.scene as never });
    const next = vi.fn();
    const after = {
      id: 'after', eligibility: { claimed: [LANE_LAYER_ID] },
      bindings: [{ spec: { kind: 'click', target: `affordance:${LANE_AFFORDANCE_KIND}` }, actionId: 'after.click' }],
    };
    const actions = [...contribution.actions as Action[], { id: 'after.click', label: 'After', invoker: { timing: 'immediate', run: next } } as Action];
    const registry = { list: () => actions, paramsOf: (_id: string, given?: object) => ({ ...given }) } as unknown as ActionsRegistry;
    const ctx: DispatcherContext = {
      actions: registry,
      depRegistry: { register: vi.fn(), get: (name: string) => (name === 'scene' ? h.scene : undefined) } as never,
      activeToolId: null,
      hotkeyStack: [],
      entriesById: new Map([[contribution.id, contribution as never], [after.id, after as never]]),
      apple: false,
    };
    return { dispatcher: createDispatcher(), ctx, next };
  }
  const mods = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };
  const on = (payload: LaneScratch) => ({ affordance: { kind: LANE_AFFORDANCE_KIND, owner: LANE_LAYER_ID, strength: 'exclusive', payload } });
  const at = (kind: string, y: number, payload: LaneScratch, extra: object = {}) =>
    ({ kind, x: 200, y, clientX: 200, clientY: y, ...mods, ...on(payload), ...extra }) as unknown as InputEvent;

  it('adds no lane for a click on a boundary, and passes the click on', () => {
    const h = pool();
    const { dispatcher, ctx, next } = surface(h);
    const boundary: LaneScratch = { targetId: h.poolId, poolId: h.poolId, laneId: h.first };
    const entries = h.scene.historyIndex();
    dispatcher.handleInput(at('click', 120, boundary, { pressX: 200, pressY: 120 }), ctx);
    expect(next).toHaveBeenCalledOnce();
    expect(lanesOf(h.scene as never, h.poolId)).toHaveLength(2);
    expect(h.scene.historyIndex()).toBe(entries);
  });

  it('adds a lane for a click on the button', () => {
    const h = pool();
    const { dispatcher, ctx, next } = surface(h);
    const button: LaneScratch = { targetId: h.poolId, poolId: h.poolId };
    dispatcher.handleInput(at('click', 260, button, { pressX: 200, pressY: 260 }), ctx);
    expect(lanesOf(h.scene as never, h.poolId)).toHaveLength(3);
    expect(next).not.toHaveBeenCalled();
  });

  it('resizes the lane for a drag on its boundary', () => {
    const h = pool();
    const { dispatcher, ctx } = surface(h);
    const boundary: LaneScratch = { targetId: h.poolId, poolId: h.poolId, laneId: h.first };
    dispatcher.handleInput(at('pointerdown', 120, boundary), ctx);
    dispatcher.handleInput(at('pointermove', 150, boundary), ctx);
    dispatcher.handleInput(at('pointerup', 150, boundary), ctx);
    expect(pose(h.scene, h.first)).toMatchObject({ height: 150 });
  });
});

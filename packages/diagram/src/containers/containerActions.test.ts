import { describe, expect, it, vi } from 'vitest';
import {
  commitOps, createDispatcher, createScene, type Action, type ActionsRegistry, type DispatcherContext, type InputEvent, scenePoseFrame, type ActionDeps, type ImmediateInvoker, type InvocationCtx, type NodeId, type OngoingHandle,
  type OngoingInvoker, type RectPose, boundsOfPath, IDENTITY_POSE_COMPOSITION, rotatedRectCorners, type PoseComposition,
} from '@weasel-js/core';
import type { Vec2 } from '@weasel-js/core/math';
import { withDiagramRegistry } from '../edge';
import { CONTAINER_STENCILS, containerBuild, lanesOf } from './containerStencils';
import { commitLaneResizeToScene, createAddLaneAction, createLaneResizeAction, createReleaseMembersAction, createDiagramContainersContribution } from './containerActions';
import { createLaneAffordance, LANE_AFFORDANCE_KIND, LANE_LAYER_ID, laneScratchOf, type LaneScratch } from './laneBoundaryLayer';

function pool(opts: { composition?: PoseComposition<RectPose>; at?: Vec2 } = {}) {
  const scene = createScene<Record<string, unknown>, 'main', RectPose>({
    systemLayers: [{ id: 'main' }], registry: withDiagramRegistry(), ...(opts.composition ? { composition: opts.composition } : {}),
  });
  let n = 0;
  const { x, y } = opts.at ?? { x: 0, y: 0 };
  const built = containerBuild(CONTAINER_STENCILS[1]!, { x, y, width: 480, height: 240 }, {
    layer: 'main', newId: () => `n${n++}`, ...(opts.composition ? { composition: opts.composition } : {}),
  });
  commitOps({ scene } as unknown as ActionDeps, built.ops, 'Insert');
  const [first, second] = lanesOf(scene as never, built.id) as unknown as [string, string];
  // At (100, 150) from the pool's corner in world, stored in the lane's frame.
  const at = scenePoseFrame(scene as never).localUnder(second as NodeId, { x: x + 100, y: y + 150, width: 40, height: 20 }) as RectPose;
  scene.add({ id: 'm' as NodeId, kind: 'mark', layer: 'main', parent: second as NodeId, pose: at, data: {} });
  return { scene, poolId: built.id, first, second };
}

const pose = (scene: ReturnType<typeof pool>['scene'], id: string) => scene.get(id as NodeId)!.pose;
const worldOf = (scene: ReturnType<typeof pool>['scene'], id: string) => scenePoseFrame(scene as never).world(id as NodeId) as RectPose;

describe('laneScratchOf', () => {
  it('reads no scratch off a hit whose payload is null or not an object', () => {
    expect(laneScratchOf({ payload: null })).toBeNull();
    expect(laneScratchOf({ payload: 'pool' })).toBeNull();
    expect(laneScratchOf({ payload: { targetId: 'p', poolId: 'p' } })).toEqual({ targetId: 'p', poolId: 'p' });
  });
});

describe('lane affordances', () => {
  it('offer a boundary after each lane and an add-lane button per pool', () => {
    const { scene, poolId, first, second } = pool();
    const regions = createLaneAffordance(scene as never).regions({} as never);
    expect(regions.map((r) => r.id)).toEqual([`${first}:boundary`, `${second}:boundary`, `${poolId}:add-lane`]);
  });
});

describe('lane affordances on a turned pool', () => {
  it('draw the boundary and the add-lane button where the turned pool draws them', () => {
    const { scene, poolId, first } = pool();
    scene.setPose(poolId as NodeId, { ...(pose(scene, poolId) as RectPose), rotation: Math.PI / 2 });
    const regions = createLaneAffordance(scene as never).regions({} as never);
    const boundary = regions.find((r) => r.id === `${first}:boundary`)!.shape as unknown as { path: never };
    const b = boundsOfPath(boundary.path);
    // The first lane's far edge, y 120 from x 32 to 480, turned a quarter about the pool's center (240, 120).
    expect(b.x).toBeCloseTo(240);
    expect(b.width).toBeCloseTo(0);
    expect(b.y).toBeCloseTo(-88);
    expect(b.height).toBeCloseTo(448);
    const add = regions.find((r) => r.id === `${poolId}:add-lane`)!.shape as { x: number; y: number; standoff: { normal: Vec2 } };
    expect(add.x).toBeCloseTo(120);
    expect(add.y).toBeCloseTo(120);
    expect(add.standoff.normal.x).toBeCloseTo(-1);
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

  it('resizes the lane in the scene it previewed, not in another scene the canvas passes', () => {
    const h = pool();
    const other = pool();
    const action = createLaneResizeAction({ scene: h.scene as never });
    const payload: LaneScratch = { targetId: h.poolId, poolId: h.poolId, laneId: h.first };
    const ctx = (at: Vec2) => ({
      world: at, screen: at, modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: { scene: other.scene } as unknown as ActionDeps,
      drag: { start: { x: 200, y: 120 }, current: at, delta: { x: at.x - 200, y: at.y - 120 }, affordance: { kind: 'layer:diagram-lanes', payload } },
    }) as unknown as InvocationCtx;
    const handle = (action.invoker as OngoingInvoker).start(ctx({ x: 200, y: 120 }), undefined) as OngoingHandle;
    handle.onMove!(ctx({ x: 200, y: 150 }));
    handle.onEnd!(ctx({ x: 200, y: 150 }), 'commit');
    expect(pose(h.scene, h.first)).toMatchObject({ height: 150 });
    expect(pose(other.scene, other.first)).toMatchObject({ height: 120 });
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

  it('offers no boundary, and hands the drag on, where the resize would move a locked member of a later lane', () => {
    const h = pool();
    h.scene.setLocked('m' as NodeId, true);
    expect(createLaneAffordance(h.scene as never).regions({} as never).map((r) => r.id)).not.toContain(`${h.first}:boundary`);
    expect(resize(h, { x: 200, y: 150 })).toEqual({});
  });

  it('offers no boundary after a hidden lane, and takes no drag on one', () => {
    const h = pool();
    h.scene.setHidden(h.first as NodeId, true);
    const regions = createLaneAffordance(h.scene as never).regions({} as never).map((r) => r.id);
    expect(regions).not.toContain(`${h.first}:boundary`);
    expect(regions).toContain(`${h.second}:boundary`);
    expect(resize(h, { x: 200, y: 150 })).toEqual({});
  });

  it('keeps the lanes in order when one grows past the lanes after it', () => {
    const h = pool();
    resize(h, { x: 200, y: 370 });
    expect(lanesOf(h.scene as never, h.poolId)).toEqual([h.first, h.second]);
    expect(pose(h.scene, h.first)).toMatchObject({ y: 0, height: 370 });
    expect(pose(h.scene, h.second)).toMatchObject({ y: 370, height: 120 });
    expect(pose(h.scene, h.poolId)).toMatchObject({ height: 490 });
  });

  it('grows a lane by a drag along its turned pool\'s stack', () => {
    const h = pool();
    h.scene.setPose(h.poolId as NodeId, { ...(pose(h.scene, h.poolId) as RectPose), rotation: Math.PI / 2 });
    // A quarter turn sends the stack's +y to world -x.
    resize(h, { x: 170, y: 140 });
    expect(pose(h.scene, h.first)).toMatchObject({ height: 150 });
  });

  it('keeps a turned pool\'s start edge in place, and the boundary under the pointer', () => {
    const h = pool();
    h.scene.setPose(h.poolId as NodeId, { ...(pose(h.scene, h.poolId) as RectPose), rotation: Math.PI / 2 });
    const start = rotatedRectCorners(worldOf(h.scene, h.first) as never)[0]!;
    const second = rotatedRectCorners(worldOf(h.scene, h.second) as never)[0]!;
    resize(h, { x: 170, y: 140 });
    const after = rotatedRectCorners(worldOf(h.scene, h.first) as never)[0]!;
    expect(after.x).toBeCloseTo(start.x);
    expect(after.y).toBeCloseTo(start.y);
    // The second lane's start, the dragged boundary, moved 30 along the stack: world -x.
    const moved = rotatedRectCorners(worldOf(h.scene, h.second) as never)[0]!;
    expect(moved.x).toBeCloseTo(second.x - 30);
    expect(moved.y).toBeCloseTo(second.y);
  });

  it('previews the titles where they draw, where poses do not compose', () => {
    const h = pool({ composition: IDENTITY_POSE_COMPOSITION as never, at: { x: 300, y: 500 } });
    resize(h, { x: 200, y: 150 }, (handle) => {
      const title = handle.previewPose!(`${h.poolId}/title`) as RectPose;
      const corners = rotatedRectCorners(title as never);
      expect(Math.min(...corners.map((c) => c.x))).toBeCloseTo(300);
      expect(Math.min(...corners.map((c) => c.y))).toBeCloseTo(500);
      expect(Math.max(...corners.map((c) => c.y))).toBeCloseTo(770);
      const lane = handle.previewPose!(`${h.first}/title`) as RectPose;
      expect(Math.min(...rotatedRectCorners(lane as never).map((c) => c.x))).toBeCloseTo(332);
    });
  });

  it('stops a lane at its least size', () => {
    const h = pool();
    resize(h, { x: 200, y: -500 });
    expect(pose(h.scene, h.first)).toMatchObject({ height: 40 });
    expect(pose(h.scene, h.second)).toMatchObject({ y: 40 });
  });
});

describe('commitLaneResizeToScene', () => {
  const ctxOf = (h: ReturnType<typeof pool>) => ({ deps: { scene: h.scene } }) as unknown as InvocationCtx;

  it('writes nothing where the resize would write a locked pool, lane, or title', () => {
    for (const lock of ['pool', 'second', 'firstTitle'] as const) {
      const h = pool();
      const id = { pool: h.poolId, second: h.second, firstTitle: `${h.first}/title` }[lock];
      h.scene.setLocked(id as NodeId, true);
      const entries = h.scene.historyIndex();
      commitLaneResizeToScene({ poolId: h.poolId, laneId: h.first, size: 150 }, ctxOf(h));
      expect(h.scene.historyIndex()).toBe(entries);
      expect(pose(h.scene, h.first)).toMatchObject({ height: 120 });
    }
  });

  it('stops a lane at its least size, as the drag does', () => {
    const h = pool();
    commitLaneResizeToScene({ poolId: h.poolId, laneId: h.first, size: -10 }, ctxOf(h));
    expect(pose(h.scene, h.first)).toMatchObject({ height: 40 });
    expect(pose(h.scene, h.second)).toMatchObject({ y: 40 });
  });

  it('throws for a size that is not a finite number', () => {
    const h = pool();
    expect(() => commitLaneResizeToScene({ poolId: h.poolId, laneId: h.first, size: Number.NaN }, ctxOf(h))).toThrow(RangeError);
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

  it('styles the lane it adds by the pool\'s lane bodies, in turn, in a scene with no theme', () => {
    const scene = createScene<Record<string, unknown>, 'main', RectPose>({ systemLayers: [{ id: 'main' }], registry: withDiagramRegistry() });
    const bodies = [
      { fill: '#000000', stroke: '#aa0000', text: '#ffffff' },
      { fill: '#000000', stroke: '#00aa00', text: '#ffffff' },
    ];
    let n = 0;
    const built = containerBuild(CONTAINER_STENCILS[1]!, { x: 0, y: 0, width: 480, height: 240 }, {
      layer: 'main', newId: () => `n${n++}`, laneStyles: { header: bodies[0]!, bodies },
    });
    commitOps({ scene } as unknown as ActionDeps, built.ops, 'Insert');
    const action = createAddLaneAction({ scene: scene as never, laneStyles: { bodies } });
    const affordance = { payload: { targetId: built.id, poolId: built.id } satisfies LaneScratch };
    (action.invoker as ImmediateInvoker).run({ scene } as never, { world: { x: 0, y: 0 }, affordance } as never);
    const strokes = lanesOf(scene as never, built.id)
      .map((id) => (scene.get(id as NodeId)!.data as { stroke: { paint: { color: string } } }).stroke.paint.color);
    expect(strokes).toEqual(['#aa0000', '#00aa00', '#aa0000']);
  });

  it('adds the lane to the scene it checked, not to another scene the canvas passes', () => {
    const h = pool();
    const other = pool();
    other.scene.setLocked(`${other.poolId}/title` as NodeId, true);
    const action = createAddLaneAction({ scene: h.scene as never });
    const affordance = { payload: { targetId: h.poolId, poolId: h.poolId } satisfies LaneScratch };
    (action.invoker as ImmediateInvoker).run({ scene: other.scene } as never, { world: { x: 0, y: 0 }, affordance } as never);
    expect(lanesOf(h.scene as never, h.poolId)).toHaveLength(3);
    expect(lanesOf(other.scene as never, other.poolId)).toHaveLength(2);
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
    const contribution = createDiagramContainersContribution({ scene: h.scene as never });
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

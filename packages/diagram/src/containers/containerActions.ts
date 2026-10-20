/**
 * The container actions: dragging the boundary after a lane resizes it, the
 * add-lane button adds one at the end of the stack, and Release members
 * removes a container and keeps what it holds. The two lane gestures take a
 * swappable commit; the default writes the scene.
 */
import {
  ActionDisabledReason,
  carriedDescendants,
  sceneCarrySource,
  type Action,
  type Contribution,
  type InvocationCtx,
  type NodeId,
  type OngoingHandle,
  type RectPose,
  type RenderLayer,
  type Scene,
} from '@weasel-js/core';
import type { Vec2 } from '@weasel-js/core/math';
import { grabPortAction, grabPortBindings } from '../connect';
import { addLane, releaseMembers } from './containerStencils';
import { LANE_AFFORDANCE_KIND, laneLayer, laneScratchOf, poolsOf, type LaneLayerOptions, type PoolLanes } from './laneBoundaryLayer';
import { MIN_LANE_SIZE } from './laneStack';
import { titlePose } from './titlePose';
import { diagramContainerOf, titleIdOf } from './trait';

/** The action that drags a lane's boundary. */
export const LANE_RESIZE_ACTION_ID = 'diagram.resizeLane';
/** The action the add-lane button runs. */
export const ADD_LANE_ACTION_ID = 'diagram.addLane';
/** The command that removes the selected containers and keeps their members. */
export const RELEASE_MEMBERS_ACTION_ID = 'diagram.releaseMembers';
const GRAB_LANE_ACTION_ID = 'diagram.grabLane';

type AnyScene = Scene<unknown, string, unknown>;

/** A lane resized: its new size along its pool's stack. */
export interface LaneResize {
  poolId: string;
  laneId: string;
  size: number;
}

/** The default commit: the lane's and the pool's new size, as one history
 *  entry labeled "Resize lane". The pool's layout restacks the lanes after it. */
export function commitLaneResizeToScene(resize: LaneResize, ctx: InvocationCtx): void {
  const scene = ctx.deps.scene as AnyScene | undefined;
  const pool = scene?.get(resize.poolId as NodeId);
  const lane = scene?.get(resize.laneId as NodeId);
  if (scene === undefined || pool === undefined || lane === undefined) return;
  const axis = diagramContainerOf(pool)?.header?.side === 'top' ? 'x' : 'y';
  const l = lane.pose as RectPose;
  const p = pool.pose as RectPose;
  const d = resize.size - (axis === 'y' ? l.height : l.width);
  scene.batch('Resize lane', () => {
    scene.setPose(lane.id, axis === 'y' ? { ...l, height: resize.size } : { ...l, width: resize.size });
    scene.setPose(pool.id, axis === 'y' ? { ...p, height: p.height + d } : { ...p, width: p.width + d });
  });
}

/** Where everything stands with the lane at `index` of `pool` resized to `size`: the
 *  lane, its title, the pool and its title, and every later lane with what it holds. */
export function laneResizeFrame(scene: AnyScene, pool: PoolLanes, index: number, size: number): Map<string, RectPose> {
  const { axis } = pool;
  const along = (r: RectPose) => (axis === 'y' ? r.height : r.width);
  const grow = (r: RectPose, by: number): RectPose => (axis === 'y' ? { ...r, height: r.height + by } : { ...r, width: r.width + by });
  const shift = (r: RectPose, by: number): RectPose => (axis === 'y' ? { ...r, y: r.y + by } : { ...r, x: r.x + by });
  const lane = pool.lanes[index]!;
  const d = size - along(lane.pose);
  const out = new Map<string, RectPose>();
  const placeTitle = (id: string, at: RectPose) => {
    const node = scene.get(id as NodeId);
    if (node !== undefined && scene.get(titleIdOf(id) as NodeId) !== undefined) {
      out.set(titleIdOf(id), titlePose(at, diagramContainerOf(node)?.header));
    }
  };
  const laneAt = grow(lane.pose, d);
  out.set(lane.id, laneAt);
  placeTitle(lane.id, laneAt);
  const poolAt = grow(pool.pose, d);
  out.set(pool.id, poolAt);
  placeTitle(pool.id, poolAt);
  for (const later of pool.lanes.slice(index + 1)) {
    out.set(later.id, shift(later.pose, d));
    const carried = carriedDescendants(sceneCarrySource(scene), later.id as NodeId, (p) => shift(p as RectPose, d));
    for (const [id, p] of carried) out.set(id, p as RectPose);
  }
  return out;
}

/** Options for the container actions. */
export interface LaneActionOptions extends LaneLayerOptions {
  scene: AnyScene;
  /** The selected ids, which Release members reads. */
  selected?: () => readonly string[];
  /** Defaults to {@link commitLaneResizeToScene}. */
  commitResize?: (resize: LaneResize, ctx: InvocationCtx) => void;
  /** Defaults to `addLane` on `deps.scene`, at the end of the stack. */
  commitAddLane?: (poolId: string, ctx: InvocationCtx) => void;
  /** Runs for each selected region in place of `releaseMembers`. */
  commitRelease?: (id: string) => void;
}

/** The `diagram.resizeLane` action: an ongoing drag moving one lane's far boundary. */
export function createLaneResizeAction(opts: LaneActionOptions): Action {
  const commit = opts.commitResize ?? commitLaneResizeToScene;
  return {
    id: LANE_RESIZE_ACTION_ID,
    label: 'Resize lane',
    group: 'diagram',
    requires: ['scene'],
    invoker: {
      timing: 'ongoing',
      start(ctx: InvocationCtx): OngoingHandle {
        const pressed = laneScratchOf(ctx.drag?.affordance);
        const pool = poolsOf(opts.scene).find((p) => p.id === pressed?.poolId);
        const index = pool?.lanes.findIndex((l) => l.id === pressed?.laneId) ?? -1;
        if (pressed === null || pool === undefined || index < 0) return {};
        const lane = pool.lanes[index]!;
        const start = pool.axis === 'y' ? lane.pose.height : lane.pose.width;
        const press: Vec2 = ctx.drag?.start ?? ctx.world;
        const sizeAt = (at: Vec2) => Math.max(MIN_LANE_SIZE, start + (pool.axis === 'y' ? at.y - press.y : at.x - press.x));
        let frame: Map<string, RectPose> | null = null;
        let open = true;
        return {
          kind: 'diagram-resize-lane',
          onMove(moveCtx: InvocationCtx): void {
            const size = sizeAt(moveCtx.world);
            frame = size === start ? null : laneResizeFrame(opts.scene, pool, index, size);
          },
          previewIds: () => (open && frame !== null ? [...frame.keys()] : null),
          previewPose: (id) => (open ? frame?.get(id) ?? null : null),
          onEnd(endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
            open = false;
            if (reason === 'cancel') return;
            const size = sizeAt(endCtx.world);
            if (size !== start) commit({ poolId: pool.id, laneId: lane.id, size }, { ...endCtx, deps: ctx.deps });
          },
        };
      },
    },
    enabled: () => true as const,
  };
}

const NO_MODIFIERS = { alt: false, shift: false, meta: false, ctrl: false };

/** The `diagram.addLane` action: the add-lane button's click. */
export function createAddLaneAction(opts: LaneActionOptions): Action {
  const commit = opts.commitAddLane ?? ((poolId: string, ctx: InvocationCtx) => {
    const scene = ctx.deps.scene as AnyScene | undefined;
    if (scene !== undefined) addLane(scene, poolId);
  });
  return {
    id: ADD_LANE_ACTION_ID,
    label: 'Add lane',
    group: 'diagram',
    requires: ['scene'],
    invoker: {
      timing: 'immediate',
      run(deps, params) {
        const pressed = laneScratchOf((params as { affordance?: { payload?: unknown } } | undefined)?.affordance);
        if (pressed === null || pressed.laneId !== undefined) return;
        const world = { x: Number(params?.worldX), y: Number(params?.worldY) };
        commit(pressed.poolId, { world, modifiers: NO_MODIFIERS, deps } as InvocationCtx);
      },
    },
    enabled: () => true as const,
  };
}

/** The selected containers, pools, and lanes. */
const selectedContainers = (opts: LaneActionOptions): string[] =>
  (opts.selected?.() ?? []).filter((id) => {
    const node = opts.scene.get(id as NodeId);
    return node !== undefined && diagramContainerOf(node) !== null;
  });

/** The `diagram.releaseMembers` command: removes each selected container and
 *  keeps what it holds, in one history entry. */
export function createReleaseMembersAction(opts: LaneActionOptions): Action {
  return {
    id: RELEASE_MEMBERS_ACTION_ID,
    label: 'Release members',
    group: 'diagram',
    requires: ['scene'],
    invoker: {
      timing: 'immediate',
      run() {
        const ids = selectedContainers(opts);
        if (ids.length === 0) return;
        const commit = opts.commitRelease;
        if (commit !== undefined) {
          for (const id of ids) commit(id);
          return;
        }
        opts.scene.batch('Release members', () => {
          for (const id of ids) releaseMembers(opts.scene, id);
        });
      },
    },
    enabled: () => (selectedContainers(opts).length > 0 ? true : ActionDisabledReason.NotApplicable),
  };
}

/**
 * Both halves of container editing: the lane layer to `registerLayer`, and
 * the contribution to pass as `ambient`, which carries the lane boundary
 * drag, the add-lane click, and the `diagram.releaseMembers` command. Like
 * `diagramPorts`, one without the other fails quietly.
 */
export function diagramContainers(opts: LaneActionOptions): { layer: RenderLayer<unknown>; contribution: Contribution } {
  const target = `affordance:${LANE_AFFORDANCE_KIND}` as const;
  return {
    layer: laneLayer(opts.scene, opts),
    contribution: {
      id: 'weasel-diagram-containers',
      eligibility: { claimed: true },
      actions: [
        createLaneResizeAction(opts), createAddLaneAction(opts), createReleaseMembersAction(opts), grabPortAction(GRAB_LANE_ACTION_ID),
      ],
      bindings: [
        { spec: { kind: 'drag', target }, actionId: LANE_RESIZE_ACTION_ID },
        { spec: { kind: 'click', target }, actionId: ADD_LANE_ACTION_ID },
        ...grabPortBindings(GRAB_LANE_ACTION_ID, LANE_AFFORDANCE_KIND).filter((b) => b.spec.kind !== 'click'),
      ],
    },
  };
}

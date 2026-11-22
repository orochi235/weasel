/**
 * The container actions: dragging the boundary after a lane resizes it, the
 * add-lane button adds one at the end of the stack, and Release members
 * removes a container and keeps what it holds. The two lane gestures take a
 * swappable commit; the default writes the scene.
 */
import {
  ActionDisabledReason,
  defineAction,
  carriedDescendants,
  composesFrames,
  RIGID_POSE_COMPOSITION,
  sceneCarrySource,
  poseFrame,
  scenePoseAdapter,
  type PoseComposition,
  type Action,
  type SurfaceContribution,
  type InvocationCtx,
  type NodeId,
  type OngoingHandle,
  type RectPose,
} from '@weasel-js/core';
import type { Vec2 } from '@weasel-js/core/math';
import { boxFrameOf, transformPoint } from '@weasel-js/geom';
import { createClaimPressAction, claimPressBindings } from '../connect';
import type { NodeStyle } from '../dataTypes';
import { DIAGRAM_THEME_KEY } from '../theme/types';
import { addLane, addLaneLocked, canReleaseMembers, lanesOf, releaseMembers } from './containerStencils';
import { laneBodyStyle } from './regionSpecs';
import {
  LANE_AFFORDANCE_KIND, LANE_LAYER_ID, createLaneLayer, laneResizable, laneScratchOf, poolLanesOf, poolsOf, stackDirection, type LaneLayerOptions,
  type PoolLanes,
} from './laneBoundaryLayer';
import { MIN_LANE_SIZE } from './laneStack';
import { titleInFrame } from './titlePose';
import { diagramContainerOf, titleIdOf } from './trait';
import type { AnyScene } from '@weasel-js/core';
import type {} from '../actionParamSchema';

/** The action that drags a lane's boundary. */
export const RESIZE_LANE_ACTION_ID = 'diagram.resizeLane';
/** The action the add-lane button runs. */
export const ADD_LANE_ACTION_ID = 'diagram.addLane';
/** The command that removes the selected containers and keeps their members. */
export const RELEASE_MEMBERS_ACTION_ID = 'diagram.releaseMembers';
const GRAB_LANE_ACTION_ID = 'diagram.grabLane';

/** A lane resized: its new size along its pool's stack. */
export interface LaneResize {
  poolId: string;
  laneId: string;
  size: number;
}

/** The default commit: every pose {@link laneResizeFrame} previews, as one history entry labeled "Resize lane". The
 *  pool's layout stacks lanes by where they sit, so the later ones are written where they go rather than left for
 *  it to find. */
export function commitLaneResizeToScene(resize: LaneResize, ctx: InvocationCtx): void {
  const scene = ctx.deps.scene as AnyScene | undefined;
  if (scene !== undefined) writeLaneResize(scene, resize);
}

function writeLaneResize(scene: AnyScene, resize: LaneResize): void {
  const pool = poolLanesOf(scene, resize.poolId);
  const index = pool?.lanes.findIndex((l) => l.id === resize.laneId) ?? -1;
  if (pool === null || index < 0) return;
  const frame = laneResizeFrame(scene, pool, index, resize.size);
  scene.batch('Resize lane', () => {
    for (const [id, pose] of frame) scene.setPose(id as NodeId, pose);
  });
}

/** `r` grown along `axis` by `by`, its start corner kept where it draws in the frame it is stored in. */
function grownFrom(r: RectPose, axis: 'x' | 'y', by: number): RectPose {
  const grown = axis === 'y' ? { ...r, height: r.height + by } : { ...r, width: r.width + by };
  const [ax, ay] = transformPoint(boxFrameOf(r)!, 0, 0);
  const [bx, by2] = transformPoint(boxFrameOf(grown)!, 0, 0);
  return { ...grown, x: grown.x + ax - bx, y: grown.y + ay - by2 };
}

/** Where everything stands with the lane at `index` of `pool` resized to `size`, as stored: the lane, its title,
 *  the pool and its title, and every later lane with what it holds. The pool's start edge stays where it draws. */
export function laneResizeFrame(scene: AnyScene, pool: PoolLanes, index: number, size: number): Map<string, RectPose> {
  const { axis } = pool;
  const pc = scene.composition as PoseComposition<RectPose>;
  // As the document holds it: mid-drag the scene shows the last preview, which this frame replaces.
  const frame = poseFrame(scenePoseAdapter(scene as never), pc);
  const along = (r: RectPose) => (axis === 'y' ? r.height : r.width);
  const shift = (r: RectPose, by: number): RectPose => (axis === 'y' ? { ...r, y: r.y + by } : { ...r, x: r.x + by });
  // The box a region lays its children out in. A layout sees a region upright where poses do not compose.
  const boxOf = (w: RectPose): RectPose => (composesFrames(pc) ? w : { x: w.x, y: w.y, width: w.width, height: w.height });
  const worldOf = (id: string, stored: RectPose): RectPose => {
    const parent = frame.parentWorld(id as NodeId) as RectPose | null;
    return parent === null ? stored : pc.compose(parent, stored);
  };
  const storedUnder = (id: string, w: RectPose, world: RectPose): RectPose | null =>
    pc.decompose(frame.childFrame(id as NodeId, w) as RectPose, world);
  const lane = pool.lanes[index]!;
  const d = size - along(lane.pose);
  const out = new Map<string, RectPose>();
  const placeTitle = (id: string, stored: RectPose, w: RectPose) => {
    const node = scene.get(id as NodeId);
    if (node === undefined || scene.get(titleIdOf(id) as NodeId) === undefined) return;
    const title = storedUnder(id, w, RIGID_POSE_COMPOSITION.compose(boxOf(w), titleInFrame(stored, diagramContainerOf(node)?.header)));
    if (title !== null) out.set(titleIdOf(id), title);
  };
  const poolStored = grownFrom(pool.pose, axis, d);
  const poolWorld = worldOf(pool.id, poolStored);
  const box = boxOf(frame.world(pool.id as NodeId) as RectPose);
  const nextBox = boxOf(poolWorld);
  // A lane moved in its pool's own axes, and stored back in the frame it is stored in.
  const moveLane = (id: string, edit: (inPool: RectPose) => RectPose): RectPose | null => {
    const inPool = RIGID_POSE_COMPOSITION.decompose(box, frame.world(id as NodeId) as RectPose);
    if (inPool === null) return null;
    const world = RIGID_POSE_COMPOSITION.compose(nextBox, edit(inPool));
    return storedUnder(pool.id, poolWorld, world);
  };
  const laneStored = moveLane(lane.id, (r) => grownFrom(r, axis, d));
  if (laneStored === null) return out;
  out.set(lane.id, laneStored);
  placeTitle(lane.id, laneStored, worldOf(lane.id, laneStored));
  out.set(pool.id, poolStored);
  placeTitle(pool.id, poolStored, poolWorld);
  const [ox, oy] = transformPoint(boxFrameOf(box)!, 0, 0);
  const [sx, sy] = transformPoint(boxFrameOf(box)!, axis === 'x' ? d : 0, axis === 'y' ? d : 0);
  for (const later of pool.lanes.slice(index + 1)) {
    const at = moveLane(later.id, (r) => shift(r, d));
    if (at === null) continue;
    out.set(later.id, at);
    const carried = carriedDescendants(sceneCarrySource(scene), later.id as NodeId, (p) => {
      const r = p as RectPose;
      return { ...r, x: r.x + sx - ox, y: r.y + sy - oy };
    });
    for (const [id, p] of carried) out.set(id, p as RectPose);
  }
  return out;
}

/** Options for the container actions. */
export interface LaneActionOptions extends LaneLayerOptions {
  /** The scene the lane layer draws, the actions check and preview against, and the default commits write. */
  scene: AnyScene;
  /** The selected ids, which Release members reads. */
  selected?: () => readonly string[];
  /** Defaults to writing what {@link commitLaneResizeToScene} writes, to `scene`. */
  commitResize?: (resize: LaneResize, ctx: InvocationCtx) => void;
  /** Defaults to `addLane` on `scene`, at the end of the stack. */
  commitAddLane?: (poolId: string, ctx: InvocationCtx) => void;
  /** The lane bodies the default add-lane commit styles a new lane by, in turn by its place, in a scene with no
   *  diagram theme; pass `containerBuild`'s `laneStyles`. Absent, a new lane takes `diagramScene`'s node style. */
  laneStyles?: { readonly bodies: readonly NodeStyle[] };
  /** Runs for each selected region in place of `releaseMembers`. */
  commitRelease?: (id: string) => void;
}

/** The `diagram.resizeLane` action: an ongoing drag moving one lane's far boundary. */
export function createLaneResizeAction(opts: LaneActionOptions): Action {
  const commit = opts.commitResize ?? ((resize: LaneResize) => writeLaneResize(opts.scene, resize));
  return {
    id: RESIZE_LANE_ACTION_ID,
    label: 'Resize lane',
    group: 'diagram',
    requires: ['scene'],
    invoker: {
      timing: 'ongoing',
      start(ctx: InvocationCtx): OngoingHandle {
        const pressed = laneScratchOf(ctx.drag?.affordance);
        const pool = poolsOf(opts.scene).find((p) => p.id === pressed?.poolId);
        const index = pool?.lanes.findIndex((l) => l.id === pressed?.laneId) ?? -1;
        if (pressed === null || pool === undefined || index < 0 || !laneResizable(opts.scene, pool, index)) return {};
        const lane = pool.lanes[index]!;
        const start = pool.axis === 'y' ? lane.pose.height : lane.pose.width;
        const press: Vec2 = ctx.drag?.start ?? ctx.world;
        // Measured along the stack as the lane is drawn, turned or scaled with its pool, in its stored units.
        const { dir, length } = stackDirection(pool.axis, lane.at);
        const perWorld = length > 0 ? start / length : 1;
        const sizeAt = (at: Vec2) => Math.max(MIN_LANE_SIZE, start + ((at.x - press.x) * dir.x + (at.y - press.y) * dir.y) * perWorld);
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

/** The `diagram.addLane` action: the add-lane button's click. A click on a lane
 *  boundary is not its own, nor one where the add would write a locked node,
 *  and it passes those on. */
export function createAddLaneAction(opts: LaneActionOptions): Action {
  const commit = opts.commitAddLane ?? ((poolId: string) => {
    const { scene } = opts;
    const themed = scene.doc.get(DIAGRAM_THEME_KEY) !== undefined;
    const style = themed ? undefined : laneBodyStyle(opts.laneStyles?.bodies ?? [], lanesOf(scene, poolId).length);
    addLane(scene, poolId, undefined, style);
  });
  return defineAction({
    id: ADD_LANE_ACTION_ID,
    label: 'Add lane',
    group: 'diagram',
    requires: ['scene'],
    invoker: {
      timing: 'immediate',
      run(deps, params) {
        const pressed = laneScratchOf(params?.affordance);
        const world = params?.world;
        if (pressed === null || pressed.laneId !== undefined || !world || addLaneLocked(opts.scene, pressed.poolId)) return 'pass';
        commit(pressed.poolId, { world, modifiers: NO_MODIFIERS, deps } as InvocationCtx);
        return undefined;
      },
    },
    enabled: () => true as const,
  });
}

/** The selected containers, pools, and lanes, that a release would change. */
const selectedContainers = (opts: LaneActionOptions): string[] =>
  (opts.selected?.() ?? []).filter((id) => canReleaseMembers(opts.scene, id));

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
 * Container editing, as one entry to pass as `ambient`: the lane layer, the
 * lane boundary drag, the add-lane click, and the `diagram.releaseMembers`
 * command.
 */
export function createDiagramContainersContribution(opts: LaneActionOptions): SurfaceContribution {
  const target = `affordance:${LANE_AFFORDANCE_KIND}` as const;
  return {
    id: 'weasel-diagram-containers',
    eligibility: { claimed: [LANE_LAYER_ID] },
    layers: [createLaneLayer(opts.scene, opts)],
    actions: [
      createLaneResizeAction(opts), createAddLaneAction(opts), createReleaseMembersAction(opts), createClaimPressAction(GRAB_LANE_ACTION_ID),
    ],
    bindings: [
      { spec: { kind: 'drag', target }, actionId: RESIZE_LANE_ACTION_ID, opts: { id: 'weasel-diagram-containers.drag' } },
      { spec: { kind: 'click', target }, actionId: ADD_LANE_ACTION_ID, opts: { id: 'weasel-diagram-containers.click' } },
      ...claimPressBindings(GRAB_LANE_ACTION_ID, LANE_AFFORDANCE_KIND).filter((b) => b.spec.kind !== 'click'),
    ],
  };
}

import type { PoseLinear } from '@weasel-js/geom';
import type { ActionDeps, InvocationCtx } from '@weasel-js/routing';
import { transformFinisher, type TransformFinisher } from '../transformFinish';
import type { Op } from 'core/ops/types';
import type { NodeId, Scene } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import { gestureReaders, type GestureReaders } from '../../gestures/shared/screenTolerance';
import type { BoundsConstraint, GestureContext, ResizeAnchor } from '../../gestures/types';
import type { GeometryProjection } from '../geometryProjection';
import { readGestureLifecycle, type GestureLifecycle } from '../gestureLifecycle';
import { nodeDescriptors, poseDescriptorOf } from '../poseDescriptorDep';
import { scenePoseFrame, type PoseFrame } from '../poseFrame';
import { buildGestureContext, captureBox, captureStarts, captureTargets, resolvePolicy } from './capture';
import type { PoseDescriptor } from './geometry';
import type { InkExtents } from 'core/geometry/inkExtents';
import { drawnBoxes } from '../drawnBoxes';
import type { MinSize } from 'core/scene/minSize';
import { boxMinimum } from './minimum';
import { boxFrame } from './boxFrame';
import { captureHeld, type HeldNode } from './held';
import { localToWorld } from 'core/geometry/targetFrame';
import { outsetBox } from 'core/geometry/inkExtents';
import type { SnapBegin, SnapSession } from '../snapDep';
import { inputSession } from 'domains/snap/session2d';

/** The box the drag resizes, as the press found it. */
export interface ResizeBox {
  /** The union for a group or a multi-selection, a lone target's own bounds
   *  otherwise. The `src` rect every write id is remapped from. */
  readonly bounds: Bounds;
  readonly anchor: ResizeAnchor;
  /** A lone target's rotation; 0 for a group. */
  readonly rotation: number;
  /** A lone target's `transform`; none for a group. */
  readonly transform?: PoseLinear;
  /** World position of the corner opposite the dragged one, which a resize
   *  in a turned or skewed frame pins. */
  readonly fixedWorld: { x: number; y: number };
  /** How far the ink reaches past `bounds` in its own frame. The handles sit
   *  on `bounds` grown by it, and the constraints see that box; the stroke
   *  does not scale, so the same extents come off whatever box they return. */
  readonly extents: InkExtents;
}

/** What a resize captured at press. Nothing here changes during the drag. */
export interface ResizeSession {
  readonly scene: Scene<unknown, string, unknown>;
  /** The ids the gesture writes: the leaf set for a group, else the selection. */
  readonly writeIds: readonly NodeId[];
  /** Whether `box` stands for several write ids, each remapped inside it,
   *  rather than being a lone target's own. */
  readonly sharedBox: boolean;
  readonly box: ResizeBox;
  /** Start poses as stored: the `from` of each op. */
  readonly startPoses: ReadonlyMap<NodeId, unknown>;
  /** Start poses in world, the frame the anchor math and the drag share. */
  readonly startWorlds: ReadonlyMap<NodeId, unknown>;
  /** What the written frames hold that the resize leaves where it draws. */
  readonly held: ReadonlyMap<NodeId, HeldNode>;
  /** Where the pointer pressed. */
  readonly startWorld: { x: number; y: number };
  readonly geometryOf: (id: NodeId) => PoseDescriptor<unknown>;
  /** World reads and local writes over the scene's composition strategy. */
  readonly poseFrame: PoseFrame<unknown>;
  readonly view: unknown;
  /** The smallest `box` may be resized to, from the written nodes' own
   *  minimums: a floor under every constraint. `null` for none. */
  readonly minimum: MinSize | null;
  readonly constraints: readonly BoundsConstraint<Bounds>[];
  /** Reused across the drag; constraints mutate its `scratch`. */
  readonly gestureCtx: GestureContext<Bounds>;
  readonly applyOps?: (ops: Op[], label: string) => void;
  /** Finishes the committed batch with the other nodes that change with it. */
  readonly finish?: TransformFinisher;
  /** When present, the commit maps each leaf's data-held geometry by the
   *  affine its pose underwent. */
  readonly geometryProjection?: GeometryProjection;
  readonly selectionMethods: SelectionApi['adapterMethods'] | undefined;
  /** Label, history, and callbacks from the `resizePolicy` dep. */
  readonly lifecycle: GestureLifecycle;
  /** The drag's snapping: the `snap` dep's session, else one that only holds
   *  the handle to its axis and Shift to the aspect. */
  readonly snap: SnapSession;
}

/** What one `onMove` produced. Replaced, not mutated, by the next. */
export interface ResizeFrame {
  /** Stored-frame pose of every write id the move reached. */
  readonly previews: Map<NodeId, unknown>;
  /** The box the move resized `ResizeBox.bounds` to; absent before the first move. */
  readonly proposed?: Bounds;
}

/** The part of a resize that a box alone decides: what it writes, the box
 *  they share, and where each starts. */
export type ResizePlace = Pick<
  ResizeSession,
  'scene' | 'writeIds' | 'sharedBox' | 'box' | 'startPoses' | 'startWorlds' | 'held' | 'geometryOf' | 'poseFrame' | 'view' | 'minimum'
>;

/** Capture what resizing `ids` from `anchor` acts on. Null when nothing it
 *  would write exists. */
export function captureResize(
  scene: Scene<unknown, string, unknown>,
  ids: readonly NodeId[],
  anchor: ResizeAnchor,
  deps: Pick<ActionDeps, 'poseDescriptor' | 'resizePolicy' | 'view' | 'boundsIncludeStroke'>,
): {
  place: ResizePlace;
  ruleOrigin: Bounds;
  policy: ActionDeps['resizePolicy'];
  constraints: BoundsConstraint<Bounds>[];
} | null {
  const geometry = poseDescriptorOf(deps.poseDescriptor);
  const policy = deps.resizePolicy;
  const { constraints, expandIds } = resolvePolicy(policy);
  const geometryOf = nodeDescriptors(scene, geometry);

  const targets = captureTargets(scene, ids, expandIds);
  if (!targets) return null;
  const { writeIds, isGroupPath } = targets;

  // The drag delta is world, so the anchor math runs on world poses — carried
  // into the plane the edit is measured in — and each result is carried back
  // to its node's plane and stored in the node's own parent frame.
  const poseFrame = scenePoseFrame(scene);
  const view = deps.view;
  const boxes = drawnBoxes({ ...deps, scene }, poseFrame);
  const starts = captureStarts(scene, writeIds, geometryOf, poseFrame, view, boxes);
  if (starts.startPoses.size === 0) return null;

  const { box, ruleOrigin } = captureBox(starts, writeIds, isGroupPath, anchor, geometry, geometryOf);
  const sharedBox = isGroupPath || writeIds.length > 1;
  const written = writeIds.filter((id) => starts.startPoses.has(id));
  return {
    place: {
      scene,
      writeIds,
      sharedBox,
      minimum: boxMinimum(scene, written, starts.leafBounds, starts.startWorlds, box.bounds, sharedBox),
      box,
      startPoses: starts.startPoses,
      startWorlds: starts.startWorlds,
      held: captureHeld(scene, written, poseFrame),
      geometryOf,
      poseFrame,
      view,
    },
    ruleOrigin,
    policy,
    constraints,
  };
}

/** The drag's snap session, over the box as drawn in its own frame. */
function beginSnap(ctx: InvocationCtx, ids: readonly NodeId[], press: { x: number; y: number }, box: ResizeBox): SnapSession {
  const frame = boxFrame(box, box.bounds);
  const req: SnapBegin = {
    gesture: 'resize',
    ids,
    press,
    handle: box.anchor,
    constrain: 'aspect',
    box: { bounds: outsetBox(box.bounds, box.extents), toWorld: (p) => localToWorld(frame, p.x, p.y) },
  };
  return ctx.deps.snap?.begin(req) ?? inputSession(req);
}

/** Capture a resize at press. Null when nothing is selected, the press is not
 *  on a resize handle, or nothing it would write exists. Runs each
 *  constraint's `onStart`. */
export function beginResize(
  ctx: InvocationCtx,
): { session: ResizeSession; readers: GestureReaders } | null {
  const selection = ctx.deps.selection;
  const scene = ctx.deps.scene;
  if (!selection || !scene) return null;

  const ids = selection.get() as NodeId[];
  if (ids.length === 0) return null;

  const anchor = ctx.drag?.affordance?.anchor;
  if (!anchor) return null;

  const captured = captureResize(scene, ids, anchor, ctx.deps);
  if (!captured) return null;
  const { place, ruleOrigin, policy, constraints } = captured;
  const startWorld = { x: ctx.drag?.start.x ?? 0, y: ctx.drag?.start.y ?? 0 };
  const readers = gestureReaders(ctx.deps);
  const gestureCtx = buildGestureContext(ctx, ids, ruleOrigin, startWorld, readers);
  for (const b of constraints) b.onStart?.(gestureCtx);

  const session: ResizeSession = {
    ...place,
    startWorld,
    constraints,
    gestureCtx,
    applyOps: ctx.deps.applyOps,
    finish: transformFinisher(ctx.deps),
    geometryProjection: ctx.deps.geometryProjection,
    selectionMethods: selection.adapterMethods,
    lifecycle: readGestureLifecycle(policy, 'Resize', constraints),
    snap: beginSnap(ctx, ids, startWorld, place.box),
  };
  return { session, readers };
}

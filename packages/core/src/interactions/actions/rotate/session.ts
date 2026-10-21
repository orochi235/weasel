import type { ActionDeps, BindingOpts, InvocationCtx } from '@weasel-js/routing';
import { pointerStateOf } from '../pointerState';
import { transformFinisher, type TransformFinisher } from '../transformFinish';
import { sceneGestureFrames } from '../gestureFrames';
import { resolveParams } from '@weasel-js/routing';
import { unionAABB } from 'core/geometry/unionBounds';
import type { Op } from 'core/ops/types';
import type { NodeId, Scene } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import { gestureReaders, type GestureReaders } from '../../gestures/shared/screenTolerance';
import type { GestureContext, RotateBehavior } from '../../gestures/types';
import { readGestureLifecycle, type GestureLifecycle } from '../gestureLifecycle';
import { moveGestureAdapter } from '../move/gestureAdapter';
import { carryPose, invertPlane, planeOf } from '../planeInput';
import { nodeDescriptors, poseDescriptorOf } from '../poseDescriptorDep';
import { scenePoseFrame, type PoseFrame } from '../poseFrame';
import type { PoseDescriptor } from '../resize/geometry';
import { drawnBoxes, type DrawnBoxes } from '../drawnBoxes';
import { shapeSources } from '../selectionSubtree';
import type { SnapBegin, SnapSession } from '../snapDep';
import { inputSession } from 'features/snap/session2d';
import { SNAP_ANGLE_STEP } from 'features/snap/roles';

/** One rotated node as the press found it, in the plane the pointer's angle
 *  is read in. */
export interface TurnOrigin {
  readonly world: unknown;
  /** Center of `world`'s bounds. */
  readonly center: { x: number; y: number };
  readonly rotation: number;
}

/** What a turn by some delta is computed from. */
export interface Turn {
  readonly origins: ReadonlyMap<NodeId, TurnOrigin>;
  /** The point the pointer orbits: the center of what the selection draws. */
  readonly pivot: { x: number; y: number };
  /** Orbit each node's center around `pivot`, for a multi-selection. Off,
   *  each node turns about its own center. */
  readonly useUnionPivot: boolean;
  readonly descriptorOf: (id: NodeId) => PoseDescriptor<unknown>;
}

/** What a rotate captured at press. Nothing here changes during the drag. */
export interface RotateSession {
  readonly scene: Scene<unknown, string, unknown>;
  readonly ids: readonly NodeId[];
  readonly turn: Turn;
  /** World reads and local writes over the scene's composition strategy. */
  readonly poseFrame: PoseFrame<unknown>;
  readonly view: unknown;
  /** Each rotated node's pose as stored: the `from` of its op. */
  readonly originPoses: ReadonlyMap<NodeId, unknown>;
  /** Pointer angle around the pivot at press. */
  readonly startPointerAngle: number;
  /** The first rotated node's rotation at press: the angle that snaps. */
  readonly theta0: number;
  /** The drag's snapping: the `snap` dep's session, else one that only
   *  steps while `snap.constrain` is held. */
  readonly snap: SnapSession;
  readonly behaviors: readonly RotateBehavior<unknown>[];
  /** Reused across the drag; behaviors mutate its `scratch`. */
  readonly gestureCtx: GestureContext<unknown>;
  readonly applyOps?: (ops: Op[], label: string) => void;
  /** Finishes the committed batch with the other nodes that change with it. */
  readonly finish?: TransformFinisher;
  readonly selectionMethods: SelectionApi['adapterMethods'] | undefined;
  readonly lifecycle: GestureLifecycle;
}

/** What one `onMove` produced. Replaced, not mutated, by the next. */
export interface RotateFrame {
  /** Radians turned since press, as the behaviors shaped it. */
  readonly delta: number;
  /** Stored-frame pose of every rotated id; empty at a zero delta. */
  readonly previews: Map<NodeId, unknown>;
}

function captureOrigins(
  view: unknown,
  scene: Scene<unknown, string, unknown>,
  ids: readonly NodeId[],
  descriptorOf: (id: NodeId) => PoseDescriptor<unknown>,
  poseFrame: PoseFrame<unknown>,
  boxes: DrawnBoxes,
): { originPoses: Map<NodeId, unknown>; origins: Map<NodeId, TurnOrigin>; visual: Bounds[] } {
  const originPoses = new Map<NodeId, unknown>();
  const origins = new Map<NodeId, TurnOrigin>();
  const visual: Bounds[] = [];
  for (const id of ids) {
    const node = scene.get(id);
    if (!node) continue;
    const g = descriptorOf(id);
    if (!g.withRotation || g.supportsRotation?.(node.pose) === false) continue;
    originPoses.set(id, node.pose);
    // The pivot is a world point, so every measurement the gesture orbits
    // is taken from the world pose, not the stored one — carried into the
    // plane the edit is measured in, where the pointer's angle is read.
    const world = carryPose(g, poseFrame.world(id), invertPlane(planeOf(view, node.layer)));
    const b = g.getBounds(world);
    origins.set(id, {
      world,
      center: { x: b.x + b.width / 2, y: b.y + b.height / 2 },
      rotation: g.getRotation?.(world) ?? 0,
    });
    visual.push(boxes.aabb(id, world));
  }
  return { originPoses, origins, visual };
}

function buildGestureContext(
  ctx: InvocationCtx,
  scene: Scene<unknown, string, unknown>,
  origins: ReadonlyMap<NodeId, TurnOrigin>,
  readers: GestureReaders,
  selectionMethods: SelectionApi['adapterMethods'],
): GestureContext<unknown> {
  return {
    draggedIds: [...origins.keys()] as string[],
    origin: new Map([...origins].map(([id, o]) => [id as string, o.world])),
    current: new Map([...origins].map(([id, o]) => [id as string, o.world])),
    snap: null,
    modifiers: { ...ctx.modifiers },
    pointer: pointerStateOf(ctx.world, ctx),
    view: readers.view(),
    plane: readers.plane(),
    kitSettings: readers.kitSettings,
    frames: sceneGestureFrames(scene, ctx.deps),
    adapter: moveGestureAdapter(scene, undefined, selectionMethods) as unknown as GestureContext<unknown>['adapter'],
    scratch: {},
  };
}

/** What turning `ids` (already resolved to shape sources) is computed from,
 *  with each one's pose as stored. Null when none of them can turn. */
export function captureTurn(
  scene: Scene<unknown, string, unknown>,
  ids: readonly NodeId[],
  deps: Pick<ActionDeps, 'view' | 'poseDescriptor' | 'boundsIncludeStroke'>,
  pivot: 'union' | 'each',
): { turn: Turn; originPoses: Map<NodeId, unknown>; poseFrame: PoseFrame<unknown> } | null {
  const view = deps.view;
  const descriptorOf = nodeDescriptors(scene, poseDescriptorOf(deps.poseDescriptor));
  // The pivot the pointer orbits is a world point, so every pose the
  // gesture turns is a world pose. Each turned result is stored back in
  // the node's own parent frame at preview and commit alike.
  const poseFrame = scenePoseFrame(scene);
  // A selection turns about the center of the box its chrome draws.
  const boxes = drawnBoxes({ ...deps, scene }, poseFrame);
  const { originPoses, origins, visual } = captureOrigins(view, scene, ids, descriptorOf, poseFrame, boxes);
  if (originPoses.size === 0) return null;
  const union = unionAABB(visual)!;
  return {
    turn: {
      origins,
      pivot: { x: union.x + union.width / 2, y: union.y + union.height / 2 },
      useUnionPivot: ids.length > 1 && pivot !== 'each',
      descriptorOf,
    },
    originPoses,
    poseFrame,
  };
}

/** The drag's snap session: the first rotated node's angle about the pivot,
 *  stepping by `SNAP_ANGLE_STEP` while `snap.constrain` is held. */
function beginSnap(ctx: InvocationCtx, ids: readonly string[], pivot: { x: number; y: number }, theta0: number): SnapSession {
  const req: SnapBegin = {
    gesture: 'rotate', ids, press: ctx.world, pivot, theta0, constrain: { step: SNAP_ANGLE_STEP },
  };
  return ctx.deps.snap?.begin(req) ?? inputSession(req);
}

/** Capture a rotate at press. Null when nothing selected can turn. Runs each
 *  behavior's `onStart`. */
export function beginRotate(
  ctx: InvocationCtx,
  opts: BindingOpts | undefined,
): { session: RotateSession; readers: GestureReaders } | null {
  const selection = ctx.deps.selection;
  const scene = ctx.deps.scene;
  const params = resolveParams(opts?.params);
  const behaviors = (opts?.behaviors ?? []) as readonly RotateBehavior<unknown>[];

  if (!selection || !scene) return null;

  // A group whose pose derives from its children turns by turning them.
  const ids = shapeSources(scene, selection.get()) as NodeId[];
  if (ids.length === 0) return null;

  const captured = captureTurn(scene, ids, ctx.deps, params?.['pivot'] === 'each' ? 'each' : 'union');
  if (!captured) return null;
  const { turn, originPoses, poseFrame } = captured;
  const { origins, pivot } = turn;
  const readers = gestureReaders(ctx.deps);
  const gestureCtx = buildGestureContext(ctx, scene, origins, readers, selection.adapterMethods);
  for (const b of behaviors) b.onStart?.(gestureCtx);
  const theta0 = origins.values().next().value?.rotation ?? 0;

  const session: RotateSession = {
    scene,
    ids,
    turn,
    poseFrame,
    view: ctx.deps.view,
    originPoses,
    startPointerAngle: Math.atan2(ctx.world.y - pivot.y, ctx.world.x - pivot.x),
    theta0,
    snap: beginSnap(ctx, [...new Set([...selection.get(), ...ids])], pivot, theta0),
    behaviors,
    gestureCtx,
    applyOps: ctx.deps.applyOps,
    finish: transformFinisher(ctx.deps),
    selectionMethods: selection.adapterMethods,
    lifecycle: readGestureLifecycle(params, 'Rotate', behaviors),
  };
  return { session, readers };
}

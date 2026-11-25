import type { ActionDeps, BindingOptions, InvocationCtx } from '@weasel-js/routing';
import { operandMethods, unionAabb, nodeDescriptors, poseDescriptorOf, scenePoseFrame, type PoseFrame, drawnBoxes, type DrawnBoxes, createBareSnapSession, SNAP_ANGLE_STEP } from '@weasel-js/core/engine';
import type { CommitSelectionMethods, GestureContext, RotateBehavior, PoseDescriptor, SnapBegin, SnapSession } from '@weasel-js/core/engine';
import { pointerStateOf, transformFinisher, type TransformFinisher, sceneGestureFrames, gestureReaders, type GestureReaders, readRunLifecycle, type RunLifecycle, carryPose, invertPlane, planeOf, shapeSources, withoutPageStructure } from '@weasel-js/core';
import { resolveParams } from '@weasel-js/routing';
import type { RotateParams, Op, NodeId, Scene, Bounds } from '@weasel-js/core';
import { moveGestureAdapter } from '../move/gestureAdapter';
import { derivedBoxOwner } from '../derivedBox';

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
   *  each node turns about its own center, or about the one `orbits` names. */
  readonly useUnionPivot: boolean;
  /** With `useUnionPivot` off, the point a selected item's source orbits when the item turns by turning its
   *  sources: the center of the item's own box. */
  readonly orbits: ReadonlyMap<NodeId, { x: number; y: number }>;
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
  readonly selectionMethods: CommitSelectionMethods | undefined;
  readonly lifecycle: RunLifecycle;
}

/** What one `onMove` produced. Replaced, not mutated, by the next. */
export interface RotateFrame {
  /** Radians the pointer has swept about the pivot since press, unwrapped
   *  across atan2's ±π seam so it never jumps a whole turn. */
  readonly swept: number;
  /** Radians turned since press, as the behaviors shaped it. */
  readonly delta: number;
  /** Stored-frame pose of every rotated id; empty at a zero delta. */
  readonly previews: Map<NodeId, unknown>;
}

const centerOf = (b: Bounds): { x: number; y: number } => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

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
    origins.set(id, {
      world,
      center: centerOf(g.getBounds(world)),
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
  selectionMethods: CommitSelectionMethods | undefined,
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

/** What turning `ids`, the shape sources of `selected`, is computed from,
 *  with each one's pose as stored. Null when none of them can turn, or, unless `locked` is `'keep'`, when one is
 *  locked: a replay keeps them so its batch answers `Locked` rather than nothing to do. */
export function captureTurn(
  scene: Scene<unknown, string, unknown>,
  selected: readonly string[],
  ids: readonly NodeId[],
  deps: Pick<ActionDeps, 'view' | 'poseDescriptor' | 'boundsIncludeStroke' | 'drawnBoxes'>,
  pivot: 'union' | 'each',
  locked: 'refuse' | 'keep' = 'refuse',
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
  // A turn rewrites every source it turns, so one that is locked stops it (ruled 2026-11-09 for commands).
  if (locked === 'refuse' && [...originPoses.keys()].some((id) => scene.isLocked?.(id) === true)) return null;
  // A derived node's chrome draws its own box, not its sources' union.
  const owner = derivedBoxOwner(scene, selected);
  const ownBox = (id: NodeId): Bounds =>
    boxes.aabb(id, carryPose(descriptorOf(id), poseFrame.world(id), invertPlane(planeOf(view, scene.get(id)!.layer))));
  const union = owner === null ? unionAabb(visual)! : ownBox(owner);
  // A derived node turns as one item about its own box, whatever its sources.
  const useUnionPivot = owner !== null || (ids.length > 1 && pivot !== 'each');
  const orbits = new Map<NodeId, { x: number; y: number }>();
  if (!useUnionPivot) {
    for (const item of selected as NodeId[]) {
      const members = shapeSources(scene, [item]) as NodeId[];
      if (scene.get(item) === undefined || (members.length === 1 && members[0] === item)) continue;
      const c = centerOf(ownBox(item));
      for (const m of members) if (origins.has(m) && !orbits.has(m)) orbits.set(m, c);
    }
  }
  return {
    turn: { origins, pivot: centerOf(union), useUnionPivot, orbits, descriptorOf },
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
  return ctx.deps.snap?.begin(req) ?? createBareSnapSession(req);
}

/** Capture a rotate at press. Null when nothing selected can turn. Runs each
 *  behavior's `onStart`. */
export function beginRotate(
  ctx: InvocationCtx<RotateParams>,
  opts: BindingOptions<Partial<RotateParams>> | undefined,
): { session: RotateSession; readers: GestureReaders } | null {
  const selection = ctx.deps.operands;
  const scene = ctx.deps.scene;
  const params = resolveParams(opts?.params);
  const behaviors = (opts?.behaviors ?? []) as readonly RotateBehavior<unknown>[];

  if (!selection || !scene) return null;

  const selected = withoutPageStructure(scene, selection.get());
  // A group whose pose derives from its children turns by turning them.
  const ids = shapeSources(scene, selected) as NodeId[];
  if (ids.length === 0) return null;

  const captured = captureTurn(scene, selected, ids, ctx.deps, params?.pivot === 'each' ? 'each' : 'union');
  if (!captured) return null;
  const { turn, originPoses, poseFrame } = captured;
  const { origins, pivot } = turn;
  const readers = gestureReaders(ctx.deps);
  const gestureCtx = buildGestureContext(ctx, scene, origins, readers, operandMethods(selection));
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
    snap: beginSnap(ctx, [...new Set([...selected, ...ids])], pivot, theta0),
    behaviors,
    gestureCtx,
    applyOps: ctx.deps.applyOps,
    finish: transformFinisher(ctx.deps),
    selectionMethods: operandMethods(selection),
    lifecycle: readRunLifecycle(params, 'Rotate', behaviors),
  };
  return { session, readers };
}

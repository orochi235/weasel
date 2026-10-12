import type { BindingOpts, InvocationCtx } from '@weasel-js/routing';
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
import { visualBoundsViaDescriptor, type PoseDescriptor } from '../resize/geometry';
import { shapeSources } from '../selectionSubtree';

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
  readonly behaviors: readonly RotateBehavior<unknown>[];
  /** Reused across the drag; behaviors mutate its `scratch`. */
  readonly gestureCtx: GestureContext<unknown>;
  readonly applyOps?: (ops: Op[], label: string) => void;
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
  ctx: InvocationCtx,
  scene: Scene<unknown, string, unknown>,
  ids: readonly NodeId[],
  descriptorOf: (id: NodeId) => PoseDescriptor<unknown>,
  poseFrame: PoseFrame<unknown>,
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
    const world = carryPose(g, poseFrame.world(id), invertPlane(planeOf(ctx.deps.view, node.layer)));
    const b = g.getBounds(world);
    origins.set(id, {
      world,
      center: { x: b.x + b.width / 2, y: b.y + b.height / 2 },
      rotation: g.getRotation?.(world) ?? 0,
    });
    visual.push(visualBoundsViaDescriptor(world, g));
  }
  return { originPoses, origins, visual };
}

function buildGestureContext(
  ctx: InvocationCtx,
  scene: Scene<unknown, string, unknown>,
  origins: ReadonlyMap<NodeId, TurnOrigin>,
  readers: GestureReaders,
): GestureContext<unknown> {
  return {
    draggedIds: [...origins.keys()] as string[],
    origin: new Map([...origins].map(([id, o]) => [id as string, o.world])),
    current: new Map([...origins].map(([id, o]) => [id as string, o.world])),
    snap: null,
    modifiers: { ...ctx.modifiers },
    pointer: { worldX: ctx.world.x, worldY: ctx.world.y, clientX: 0, clientY: 0 },
    view: readers.view(),
    plane: readers.plane(),
    adapter: moveGestureAdapter(scene) as unknown as GestureContext<unknown>['adapter'],
    scratch: {},
  };
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
  const behaviors = (opts?.behaviors ?? []) as RotateBehavior<unknown>[];

  if (!selection || !scene) return null;

  // A group whose pose derives from its children turns by turning them.
  const ids = shapeSources(scene, selection.get()) as NodeId[];
  if (ids.length === 0) return null;

  const descriptorOf = nodeDescriptors(scene, poseDescriptorOf(ctx.deps.poseDescriptor));
  // The pivot the pointer orbits is a world point, so every pose the
  // gesture turns is a world pose. Each turned result is stored back in
  // the node's own parent frame at preview and commit alike.
  const poseFrame = scenePoseFrame(scene, ctx.deps.poseComposition);
  const { originPoses, origins, visual } = captureOrigins(ctx, scene, ids, descriptorOf, poseFrame);
  if (originPoses.size === 0) return null;

  const union = unionAABB(visual)!;
  const pivot = { x: union.x + union.width / 2, y: union.y + union.height / 2 };
  const readers = gestureReaders(ctx.deps);
  const gestureCtx = buildGestureContext(ctx, scene, origins, readers);
  for (const b of behaviors) b.onStart?.(gestureCtx);

  const session: RotateSession = {
    scene,
    ids,
    turn: {
      origins,
      pivot,
      useUnionPivot: ids.length > 1 && params?.['pivot'] !== 'each',
      descriptorOf,
    },
    poseFrame,
    view: ctx.deps.view,
    originPoses,
    startPointerAngle: Math.atan2(ctx.world.y - pivot.y, ctx.world.x - pivot.x),
    behaviors,
    gestureCtx,
    applyOps: ctx.deps.applyOps,
    selectionMethods: selection.adapterMethods,
    lifecycle: readGestureLifecycle(params, 'Rotate', behaviors),
  };
  return { session, readers };
}

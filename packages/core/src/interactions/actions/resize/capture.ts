import type { InvocationCtx } from '@weasel-js/routing';
import { pointerStateOf } from '../pointerState';
import { sceneGestureFrames } from '../gestureFrames';
import { unionAABB, unionBounds } from 'core/geometry/unionBounds';
import type { NodeId, Scene } from 'core/scene/types';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import type { GestureReaders } from '../../gestures/shared/screenTolerance';
import type { BoundsConstraint, GestureContext, PointSnapBehavior, ResizeAnchor } from '../../gestures/types';
import type { ResizePolicy } from '../depSchema';
import { carryPose, invertPlane, planeOf } from '../planeInput';
import type { PoseFrame } from '../poseFrame';
import { rotatePoint } from '../rotate/geometry';
import { shapeSources } from '../selectionSubtree';
import { DEFAULT_RESIZE_BEHAVIORS } from './behaviors';
import { fixedCornerOf } from './cornerHandles';
import { visualBoundsViaDescriptor, type PoseDescriptor } from './geometry';
import { boundsForRules } from './ruleBounds';
import type { ResizeBox } from './session';

const IDENTITY_EXPAND = (ids: string[]) => ids;
const EMPTY_POINT_SNAP: PointSnapBehavior<Bounds>[] = [];

/** The `resizePolicy` dep's rules, or the defaults when it is unsourced. */
export function resolvePolicy(dep: ResizePolicy<unknown> | undefined): {
  constraints: BoundsConstraint<Bounds>[];
  pointSnap: PointSnapBehavior<Bounds>[];
  expandIds: (ids: string[]) => string[];
} {
  if (!dep) {
    return {
      // Standard kit behaviors (shift = aspect lock) apply even with no
      // policy wired; consumers opt out via an explicit `constraints: []`.
      constraints: DEFAULT_RESIZE_BEHAVIORS as BoundsConstraint<Bounds>[],
      pointSnap: EMPTY_POINT_SNAP,
      expandIds: IDENTITY_EXPAND,
    };
  }
  return {
    constraints: dep.constraints as unknown as BoundsConstraint<Bounds>[],
    pointSnap: dep.pointSnap as unknown as PointSnapBehavior<Bounds>[],
    expandIds: dep.expandIds,
  };
}

/** The ids the gesture writes, and whether one selected id stands for them.
 *  A lone id the policy expands into a different set is the group path:
 *  every leaf is written, against the union of their bounds. Otherwise the
 *  selected ids are written directly. A group whose pose derives from its
 *  children is resized by resizing them, whatever the policy expanded to.
 *  Null when there is nothing to write. */
export function captureTargets(
  scene: Scene<unknown, string, unknown>,
  ids: readonly NodeId[],
  expandIds: (ids: string[]) => string[],
): { writeIds: NodeId[]; isGroupPath: boolean } | null {
  const expanded = shapeSources(scene, expandIds(ids as unknown as string[]));
  if (expanded.length === 0) return null;
  const isGroupPath =
    ids.length === 1 && (expanded.length !== 1 || expanded[0] !== (ids[0] as string));
  const writeIds = (isGroupPath || ids.length > 1 ? expanded : (ids as unknown as string[])) as NodeId[];
  return { writeIds, isGroupPath };
}

export interface ResizeStarts {
  /** As stored. */
  startPoses: Map<NodeId, unknown>;
  /** In world, carried into the plane the edit is measured in. */
  startWorlds: Map<NodeId, unknown>;
  leafBounds: Bounds[];
  drawnBounds: Bounds[];
}

export function captureStarts(
  scene: Scene<unknown, string, unknown>,
  writeIds: readonly NodeId[],
  geometryOf: (id: NodeId) => PoseDescriptor<unknown>,
  poseFrame: PoseFrame<unknown>,
  view: unknown,
): ResizeStarts {
  const startPoses = new Map<NodeId, unknown>();
  const startWorlds = new Map<NodeId, unknown>();
  const leafBounds: Bounds[] = [];
  const drawnBounds: Bounds[] = [];
  for (const id of writeIds) {
    const node = scene.get(id);
    if (!node) continue;
    startPoses.set(id, node.pose);
    const g = geometryOf(id);
    const world = carryPose(g, poseFrame.world(id), invertPlane(planeOf(view, node.layer)));
    startWorlds.set(id, world);
    leafBounds.push(g.getBounds(world));
    drawnBounds.push(visualBoundsViaDescriptor(world, g));
  }
  return { startPoses, startWorlds, leafBounds, drawnBounds };
}

/** The box the drag resizes, and that box as the constraints read it.
 *  `starts` must hold at least one pose. */
export function captureBox(
  starts: Pick<ResizeStarts, 'startWorlds' | 'leafBounds' | 'drawnBounds'>,
  writeIds: readonly NodeId[],
  isGroupPath: boolean,
  anchor: ResizeAnchor,
  geometry: PoseDescriptor<unknown>,
  geometryOf: (id: NodeId) => PoseDescriptor<unknown>,
): { box: ResizeBox; ruleOrigin: Bounds } {
  const { leafBounds, drawnBounds } = starts;
  // A multi-selection's handles sit on the union of what is drawn, so that
  // is the box its drag resizes.
  const bounds = leafBounds.length === 1
    ? leafBounds[0]
    : isGroupPath ? unionBounds(leafBounds)! : unionAABB(drawnBounds)!;

  // Rotation captured only for the single-write-id path; group-resize
  // takes the AABB-frame (unrotated) path even if leaves have rotation.
  const lone = !isGroupPath && writeIds.length === 1;
  const originPose = lone ? starts.startWorlds.get(writeIds[0]) : (bounds as unknown);
  // A lone target is read as its own shape; a shared box is a plain rect.
  const originGeometry = lone ? geometryOf(writeIds[0]) : geometry;
  const rotation = !isGroupPath ? (originGeometry.getRotation?.(originPose) ?? 0) : 0;

  const fixedLocal = fixedCornerOf(bounds, anchor);
  const fixedWorld = rotation === 0
    ? fixedLocal
    : rotatePoint(
        fixedLocal.x, fixedLocal.y,
        bounds.x + bounds.width / 2,
        bounds.y + bounds.height / 2,
        rotation,
      );
  return {
    box: { bounds, anchor, rotation, fixedWorld },
    ruleOrigin: boundsForRules(originGeometry, originPose),
  };
}

/** The context the constraints read. `draggedIds` is the selection, not the
 *  ids written, and the one pose it tracks is keyed by the first selected id. */
export function buildGestureContext(
  ctx: InvocationCtx,
  ids: readonly NodeId[],
  ruleOrigin: Bounds,
  startWorld: { x: number; y: number },
  readers: GestureReaders,
): GestureContext<Bounds> {
  return {
    draggedIds: ids as unknown as string[],
    origin: new Map<string, Bounds>([[ids[0] as string, ruleOrigin]]),
    current: new Map<string, Bounds>([[ids[0] as string, ruleOrigin]]),
    snap: null,
    modifiers: { ...ctx.modifiers },
    pointer: pointerStateOf(startWorld, ctx),
    view: readers.view(),
    plane: readers.plane(),
    ...(ctx.deps.scene
      ? { frames: sceneGestureFrames(ctx.deps.scene, ctx.deps.view) as GestureContext<Bounds>['frames'] }
      : {}),
    // `adapter` is unused by the kit's behaviors; cast to satisfy the type.
    adapter: undefined as unknown as GestureContext<Bounds>['adapter'],
    scratch: {},
  };
}

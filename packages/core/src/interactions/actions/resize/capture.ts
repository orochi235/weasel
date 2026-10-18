import { poseLinearOf } from '@weasel-js/geom';
import type { InvocationCtx } from '@weasel-js/routing';
import { localToWorld } from 'core/geometry/targetFrame';
import { pointerStateOf } from '../pointerState';
import { sceneGestureFrames } from '../gestureFrames';
import { unionAABB, unionBounds } from 'core/geometry/unionBounds';
import type { NodeId, Scene } from 'core/scene/types';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import type { GestureReaders } from '../../gestures/shared/screenTolerance';
import type { BoundsConstraint, GestureContext, ResizeAnchor } from '../../gestures/types';
import type { ResizePolicy } from '../depSchema';
import { carryPose, invertPlane, planeOf } from '../planeInput';
import type { PoseFrame } from '../poseFrame';
import { shapeSources } from '../selectionSubtree';
import { fixedCornerOf } from './cornerHandles';
import { visualBoundsViaDescriptor, type PoseDescriptor } from './geometry';
import { boundsForRules } from './ruleBounds';
import { boxFrame } from './boxFrame';
import type { ResizeBox } from './session';
import type { DrawnBoxes } from '../drawnBoxes';
import {
  inkExtentsBetween,
  isNoInkExtents,
  NO_INK_EXTENTS,
  outsetBox,
  type InkExtents,
} from 'core/geometry/inkExtents';

const IDENTITY_EXPAND = (ids: string[]) => ids;

/** The `resizePolicy` dep's rules, or the defaults when it is unsourced. */
export function resolvePolicy(dep: ResizePolicy<unknown> | undefined): {
  constraints: BoundsConstraint<Bounds>[];
  expandIds: (ids: string[]) => string[];
} {
  if (!dep) {
    return {
      constraints: [],
      expandIds: IDENTITY_EXPAND,
    };
  }
  return {
    constraints: dep.constraints as unknown as BoundsConstraint<Bounds>[],
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
  /** Each write id's pose box, unturned. */
  leafBounds: Bounds[];
  /** Each write id's pose box as it covers the world, turned. */
  drawnBounds: Bounds[];
  /** How far each write id's ink reaches past its pose box. */
  leafExtents: InkExtents[];
  /** `drawnBounds` with the ink. */
  inkedBounds: Bounds[];
}

export function captureStarts(
  scene: Scene<unknown, string, unknown>,
  writeIds: readonly NodeId[],
  geometryOf: (id: NodeId) => PoseDescriptor<unknown>,
  poseFrame: PoseFrame<unknown>,
  view: unknown,
  boxes: DrawnBoxes,
): ResizeStarts {
  const startPoses = new Map<NodeId, unknown>();
  const startWorlds = new Map<NodeId, unknown>();
  const leafBounds: Bounds[] = [];
  const drawnBounds: Bounds[] = [];
  const leafExtents: InkExtents[] = [];
  const inkedBounds: Bounds[] = [];
  for (const id of writeIds) {
    const node = scene.get(id);
    if (!node) continue;
    startPoses.set(id, node.pose);
    const g = geometryOf(id);
    const world = carryPose(g, poseFrame.world(id), invertPlane(planeOf(view, node.layer)));
    startWorlds.set(id, world);
    leafBounds.push(g.getBounds(world));
    drawnBounds.push(visualBoundsViaDescriptor(world, g));
    leafExtents.push(boxes.extents(id, world));
    inkedBounds.push(boxes.aabb(id, world));
  }
  return { startPoses, startWorlds, leafBounds, drawnBounds, leafExtents, inkedBounds };
}

/** How far the ink of everything in a box reaches past it: a lone target's
 *  own extents, or the union of the members as drawn past their union. */
function boxExtents(
  starts: Pick<ResizeStarts, 'leafBounds' | 'leafExtents' | 'inkedBounds'>,
  bounds: Bounds,
  isGroupPath: boolean,
): InkExtents {
  const { leafBounds, leafExtents } = starts;
  if (leafBounds.length === 1) return leafExtents[0]!;
  if (leafExtents.every(isNoInkExtents)) return NO_INK_EXTENTS;
  const inked = isGroupPath
    ? unionBounds(leafBounds.map((b, i) => outsetBox(b, leafExtents[i]!)))
    : unionAABB(starts.inkedBounds);
  return inked ? inkExtentsBetween(bounds, inked) : NO_INK_EXTENTS;
}

/** The box the drag resizes, and that box as the constraints read it.
 *  `starts` must hold at least one pose. */
export function captureBox(
  starts: Pick<ResizeStarts, 'startWorlds' | 'leafBounds' | 'drawnBounds' | 'leafExtents' | 'inkedBounds'>,
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
  const transform = (lone && poseLinearOf(originPose)) || undefined;

  const fixedLocal = fixedCornerOf(bounds, anchor);
  const fixedWorld = localToWorld(boxFrame({ rotation, transform }, bounds), fixedLocal.x, fixedLocal.y);
  const extents = boxExtents(starts, bounds, isGroupPath);
  return {
    box: { bounds, anchor, rotation, transform, fixedWorld, extents },
    ruleOrigin: outsetBox(boundsForRules(originGeometry, originPose), extents),
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
    kitSettings: readers.kitSettings,
    ...(ctx.deps.scene
      ? { frames: sceneGestureFrames(ctx.deps.scene, ctx.deps) as GestureContext<Bounds>['frames'] }
      : {}),
    // `adapter` is unused by the kit's behaviors; cast to satisfy the type.
    adapter: undefined as unknown as GestureContext<Bounds>['adapter'],
    scratch: {},
  };
}

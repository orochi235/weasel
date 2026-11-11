import type { NodeId, Scene } from 'core/scene/types';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import { shapeSources, uncarried } from '../selectionSubtree';
import { withoutPageStructure } from 'core/scene/nodeGates';
import type { Op } from 'core/ops/types';
import { multiply, rotate, translate, type Affine } from '@weasel-js/geom';
import { createTransformOp } from 'core/ops/transform';
import type { PoseDescriptor } from '../resize/geometry';
import { poseDescriptorOf } from '../poseDescriptorDep';
import {
  flipPoseAboutBounds,
  flipPoseViaDescriptor,
  type FlipAxis,
  type FlipPivot,
} from './helpers';
import { unionAABB } from 'core/geometry/unionBounds';
import { drawnBoxes, type DrawnBoxes } from '../drawnBoxes';
import { isNoInkExtents } from 'core/geometry/inkExtents';
import { scenePoseFrame, type PoseFrame } from '../poseFrame';
import { actionReferenceSources, resolveSpatialReference } from '../spatialReference';
import type { PointerContextValue } from '@weasel-js/routing/react';
import type { RectPose } from 'core/scene/types';
import type { Action, ActionDeps } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import { sameValue } from 'core/scene/sameValue';
import { finiteThroughout } from '../finiteFrame';
import { defaultCommitAdapter } from '../defaultCommitAdapter';
import { transformApplyOps } from '../transformFinish';
import { requiresSelection } from '../defaults/requiresSelection';
import type { SelectionApi } from 'core/selection/useSelection';
import { geometryDataOp, type GeometryProjection } from '../geometryProjection';
import { icon } from '../../../icons.gen';
import { BETWEEN_GESTURES } from '@weasel-js/routing';

/**
 * The world mirror about `axis` through the center of `pivotWorld`, written in
 * the frame `id` stores its data in. `geometryProjection.transform` is given
 * the affine the node's own pose underwent, and data-held geometry is local —
 * so a world mirror has to be conjugated by the frame or an asymmetric shape
 * reflects across the wrong line while its pose lands correctly.
 *
 * The frame's turn comes back as the rotation on a rebased zero-size pose at
 * the pivot point, so no composition strategy has to expose one.
 */
function localMirror(
  axis: FlipAxis,
  frame: PoseFrame<unknown>,
  id: Parameters<PoseFrame<unknown>['local']>[0],
  pivotWorld: { x: number; y: number; width: number; height: number },
): Affine {
  const at = frame.local(id, {
    x: pivotWorld.x + pivotWorld.width / 2,
    y: pivotWorld.y + pivotWorld.height / 2,
    width: 0,
    height: 0,
    rotation: 0,
  }) as RectPose;
  const theta = at.rotation ?? 0;
  const mirror: Affine = axis === 'x' ? [-1, 0, 0, 1, 0, 0] : [1, 0, 0, -1, 0, 0];
  const turned = multiply(multiply(rotate(theta), mirror), rotate(-theta));
  return multiply(translate(at.x, at.y), multiply(turned, translate(-at.x, -at.y)));
}

/**
 * The ops a flip of the current selection in `scene` along `axis` commits as
 * one undo entry: none for a node the flip leaves as it was, so the list is
 * empty when nothing would change.
 *
 * Pivot: `'each'` (per-item own AABB) unless the caller passes `'union'`,
 * which mirrors every pose about the selection's *visual* union AABB — the
 * rotated ink extents — so items swap sides as well as reflect, or a
 * `SpatialReference`, which mirrors about the center of what it names. A rotated
 * member's own mirrored position needs no expansion: `axisAlignedBounds`
 * keeps the stored box's center, so mirroring either box lands the same place.
 */
function flipOps(
  selection: Pick<SelectionApi, 'get'>,
  scene: Scene<unknown, string, unknown>,
  axis: FlipAxis,
  pivot: FlipPivot,
  geometryProjection: GeometryProjection | undefined,
  geom: PoseDescriptor<unknown>,
  params: Record<string, unknown> | undefined,
  pointer: PointerContextValue | undefined,
  boxesOver: (frame: PoseFrame<unknown>) => DrawnBoxes,
): Op[] {
  const selected = withoutPageStructure(scene, selection.get());
  if (selected.length === 0) return [];
  const frame = scenePoseFrame(scene);
  const boxes = boxesOver(frame);

  // A group whose pose derives from its children mirrors by mirroring them,
  // about the group's own box where each selected node flips in place.
  const reached: NodeId[] = [];
  const ownPivot = new Map<string, Bounds>();
  for (const id of selected) {
    const members = shapeSources(scene, [id]) as NodeId[];
    const stoodIn = members.length !== 1 || members[0] !== id;
    const box = stoodIn ? boxes.aabb(id, frame.world(id)) : null;
    for (const member of members) {
      if (reached.includes(member)) continue;
      reached.push(member);
      if (box) ownPivot.set(member, box);
    }
  }
  const ids = uncarried(frame, reached);

  const worlds = new Map<string, unknown>();
  for (const id of ids) {
    if (scene.get(id) === undefined) continue;
    const world = frame.world(id);
    worlds.set(id as string, world);
    // A shape whose ink reaches past its box unevenly flips in place about
    // the box it is drawn with, so that box stays put.
    if (!ownPivot.has(id as string) && !isNoInkExtents(boxes.extents(id, world))) {
      ownPivot.set(id as string, boxes.aabb(id, world));
    }
  }
  let sharedPivot: ReturnType<typeof unionAABB> = null;
  if (pivot === 'union') {
    sharedPivot = unionAABB([...worlds].map(([id, p]) => boxes.aabb(id, p)));
  } else if (pivot !== 'each') {
    sharedPivot = resolveSpatialReference(pivot, actionReferenceSources(params, pointer, scene, frame, boxes));
    if (sharedPivot === null) return [];
  }

  const ops: Op[] = [];
  for (const id of ids) {
    const node = scene.get(id);
    if (!node) continue;
    const world = worlds.get(id as string)!;
    const about = sharedPivot ?? ownPivot.get(id as string) ?? null;
    const flipped = about
      ? flipPoseAboutBounds(world, axis, geom, about)
      : flipPoseViaDescriptor(world, axis, geom);
    const to = frame.local(id, flipped);
    // A mirror image past the double range cannot be drawn, so the flip cannot land.
    if (!finiteThroughout(to)) return [];
    const moved = !sameValue(node.pose, to);
    if (moved) ops.push(createTransformOp<unknown>({ id: id as string, from: node.pose, to, label: 'Flip' }));
    // Mirror the data-held geometry about the SAME pivot the pose flip uses.
    // A pose-only flip of a bare-AABB pose is identity, so this data op is
    // the only way an asymmetric shape actually mirrors.
    const g = about ?? geom.getBounds(world);
    const dataOp = geometryDataOp(
      geometryProjection,
      { id: id as string, data: node.data, pose: node.pose },
      localMirror(axis, frame, id, g),
      to,
      'Flip',
    );
    if (dataOp) {
      if (!moved) ops.push(createTransformOp<unknown>({ id: id as string, from: node.pose, to, label: 'Flip' }));
      ops.push(dataOp);
    }
  }
  return ops;
}

function flipParams(params: Readonly<Record<string, unknown>> | undefined): { axis: FlipAxis; pivot: FlipPivot } {
  return { axis: (params?.axis as FlipAxis | undefined) ?? 'x', pivot: (params?.pivot as FlipPivot | undefined) ?? 'each' };
}

function flipOpsFor(deps: ActionDeps, selection: Pick<SelectionApi, 'get'>, scene: Scene<unknown, string, unknown>, params: Readonly<Record<string, unknown>> | undefined): Op[] {
  const { axis, pivot } = flipParams(params);
  return flipOps(
    selection, scene, axis, pivot, deps.geometryProjection, poseDescriptorOf(deps.poseDescriptor),
    params as Record<string, unknown> | undefined, deps.pointer, (frame) => drawnBoxes(deps, frame),
  );
}

/**
 * Flips the selection. `params.axis` (`'x'` | `'y'`, default `'x'`) picks the
 * direction, and the optional `params.pivot` (a `FlipPivot`, default `'each'`)
 * picks what it mirrors about.
 */
export const flipAction: Action & { requires: string[] } = {
  id: 'flip',
  label: 'Flip',
  group: 'flip',
  tags: ['mirror'],
  variants: [
    { key: 'x', label: 'Flip Horizontal', icon: icon('flipX'), params: { axis: 'x' } },
    { key: 'y', label: 'Flip Vertical', icon: icon('flipY'), params: { axis: 'y' } },
  ],
  defaultBinding: [
    { spec: { kind: 'key', key: ['h', 'H'], mods: { shift: true }, phase: BETWEEN_GESTURES }, opts: { id: 'flip.x', params: { axis: 'x' } } },
    { spec: { kind: 'key', key: ['v', 'V'], mods: { shift: true }, phase: BETWEEN_GESTURES }, opts: { id: 'flip.y', params: { axis: 'y' } } },
  ],
  eligible: { capability: 'transforms-selection' },
  requires: [
    'selection', 'scene', 'applyOps', 'geometryProjection', 'poseDescriptor', 'pointer', 'view', 'boundsIncludeStroke', 'drawnBoxes',
    'transformFollowers',
  ],
  invoker: {
    timing: 'immediate',
    run: (deps, params) => {
      const selection = deps.selection;
      const scene = deps.scene;
      if (!selection || !scene) return;
      const ops = flipOpsFor(deps, selection, scene, params);
      if (ops.length === 0) return;
      const applyOps = transformApplyOps(deps);
      if (applyOps) applyOps(ops, 'Flip');
      else scene.applyBatch(ops, 'Flip', defaultCommitAdapter(scene, selection.adapterMethods));
    },
  },
  enabled: (deps, _at, _carried, params) => {
    const needs = requiresSelection(deps);
    if (needs !== true) return needs;
    return flipOpsFor(deps!, deps!.selection!, deps!.scene!, params).length > 0 ? true : ActionDisabledReason.NotApplicable;
  },
};

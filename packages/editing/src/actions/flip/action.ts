import type { NodeId, Scene, OperandsDep, Bounds, Op, PoseDescriptor, RectPose } from '@weasel-js/core';
import { shapeSources, uncarried, withoutPageStructure, poseDescriptorOf, nodeDescriptors, unionAabb, drawnBoxes, type DrawnBoxes, isNoInkExtents, scenePoseFrame, type PoseFrame, actionReferenceSources, resolveSpatialReference, sameValue, finiteThroughout, requiresOperands, type GeometryProjection } from '@weasel-js/core';
import { invert, multiply, translate, type Affine, type Rect } from '@weasel-js/geom';
import {
  flipPoseAboutBounds,
  flipPoseViaDescriptor,
  type FlipAxis,
  type FlipPivot,
} from './helpers';
import type { PointerContextValue } from '@weasel-js/routing/react';
import type { ActionDeps } from '@weasel-js/routing';
import { ActionDisabledReason, defineAction, BETWEEN_GESTURES } from '@weasel-js/routing';
import type { FlipParams } from '../../actionParamSchema';
import { icon } from '../../icons.gen';
import { FLIP_GROUP } from '../../actionGroups';
import * as coreOps from '@weasel-js/core/ops';
import { commitTransform, transformAnswer } from '../lockedWrites';
import { derivedBoxOwner } from '../derivedBox';

/**
 * The world mirror about `axis` through the center of `pivotWorld`, written in
 * the frame `id` stores its data in. `geometryProjection.transform` is given
 * the affine the node's own pose underwent, and data-held geometry is local —
 * so a world mirror has to be conjugated by the frame or an asymmetric shape
 * reflects across the wrong line while its pose lands correctly.
 *
 * The frame is read as where it stores three world points, as zero-size poses, so no composition strategy has
 * to expose its affine, and a frame that shears or scales unevenly is conjugated as fully as a turned one.
 */
function localMirror(
  axis: FlipAxis,
  frame: PoseFrame<unknown>,
  id: Parameters<PoseFrame<unknown>['local']>[0],
  pivotWorld: Rect,
): Affine | null {
  const cx = pivotWorld.x + pivotWorld.width / 2;
  const cy = pivotWorld.y + pivotWorld.height / 2;
  const at = (x: number, y: number) => frame.local(id, { x, y, width: 0, height: 0, rotation: 0 }) as RectPose | null;
  const o = at(cx, cy), ex = at(cx + 1, cy), ey = at(cx, cy + 1);
  if (o === null || ex === null || ey === null) return null;
  // World to local about the pivot: its columns are where a unit step along each world axis lands.
  const toLocal: Affine = [ex.x - o.x, ex.y - o.y, ey.x - o.x, ey.y - o.y, 0, 0];
  const toWorld = invert(toLocal);
  if (toWorld === null) return null;
  const mirror: Affine = axis === 'x' ? [-1, 0, 0, 1, 0, 0] : [1, 0, 0, -1, 0, 0];
  const conjugated = multiply(multiply(toLocal, mirror), toWorld);
  return multiply(translate(o.x, o.y), multiply(conjugated, translate(-o.x, -o.y)));
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
  selection: Pick<OperandsDep, 'get'>,
  scene: Scene<unknown, string, unknown>,
  axis: FlipAxis,
  pivot: FlipPivot,
  geometryProjection: GeometryProjection | undefined,
  descriptorOf: (id: NodeId) => PoseDescriptor<unknown>,
  params: Readonly<Partial<FlipParams>> | undefined,
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
  let sharedPivot: ReturnType<typeof unionAabb> = null;
  if (pivot === 'union') {
    const owner = derivedBoxOwner(scene, selected);
    sharedPivot = owner
      ? boxes.aabb(owner, frame.world(owner))
      : unionAabb([...worlds].map(([id, p]) => boxes.aabb(id, p)));
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
    const geom = descriptorOf(id);
    const flipped = about
      ? flipPoseAboutBounds(world, axis, geom, about)
      : flipPoseViaDescriptor(world, axis, geom);
    const to = frame.local(id, flipped);
    // A node in a singular frame, which no stored pose mirrors, stays as it is.
    if (to === null) continue;
    // A mirror image past the double range cannot be drawn, so the flip cannot land.
    if (!finiteThroughout(to)) return [];
    const mirror = localMirror(axis, frame, id, about ?? geom.getBounds(world));
    if (mirror === null) continue;
    const moved = !sameValue(node.pose, to);
    if (moved) ops.push(coreOps.setPose<unknown>({ id: id as string, from: node.pose, to, label: 'Flip' }));
    // Mirror the data-held geometry about the SAME pivot the pose flip uses.
    // A pose-only flip of a bare-AABB pose is identity, so this data op is
    // the only way an asymmetric shape actually mirrors.
    const dataOp = coreOps.geometryData(
      geometryProjection,
      { id: id as string, data: node.data, pose: node.pose },
      mirror,
      to,
      'Flip',
    );
    if (dataOp) {
      if (!moved) ops.push(coreOps.setPose<unknown>({ id: id as string, from: node.pose, to, label: 'Flip' }));
      ops.push(dataOp);
    }
  }
  return ops;
}

function flipOpsFor(deps: ActionDeps, selection: Pick<OperandsDep, 'get'>, scene: Scene<unknown, string, unknown>, params: Readonly<Partial<FlipParams>> | undefined): Op[] {
  return flipOps(
    selection, scene, params?.axis ?? 'x', params?.pivot ?? 'each', deps.geometryProjection,
    nodeDescriptors(scene, poseDescriptorOf(deps.poseDescriptor)), params, deps.pointer, (frame) => drawnBoxes(deps, frame),
  );
}

/**
 * Flips the selection. `params.axis` (`'x'` | `'y'`, default `'x'`) picks the
 * direction, and the optional `params.pivot` (a `FlipPivot`, default `'each'`)
 * picks what it mirrors about.
 */
export const flipAction = defineAction({
  id: 'flip',
  label: 'Flip',
  group: FLIP_GROUP,
  tags: ['mirror'],
  variants: [
    { key: 'x', label: 'Flip Horizontal', icon: icon('flipX'), params: { axis: 'x' } },
    { key: 'y', label: 'Flip Vertical', icon: icon('flipY'), params: { axis: 'y' } },
  ],
  defaultBinding: [
    { spec: { kind: 'key', key: 'h', mods: { shift: true }, phase: BETWEEN_GESTURES }, opts: { id: 'flip.x', params: { axis: 'x' } } },
    { spec: { kind: 'key', key: 'v', mods: { shift: true }, phase: BETWEEN_GESTURES }, opts: { id: 'flip.y', params: { axis: 'y' } } },
  ],
  eligible: { capability: 'transforms-selection' },
  requires: [
    'operands', 'scene', 'applyOps', 'geometryProjection', 'poseDescriptor', 'pointer', 'view', 'boundsIncludeStroke', 'drawnBoxes',
    'transformFollowers',
  ],
  invoker: {
    timing: 'immediate',
    run: (deps, params) => {
      const selection = deps.operands;
      const scene = deps.scene;
      if (!selection || !scene) return;
      commitTransform(deps, scene, flipOpsFor(deps, selection, scene, params), 'Flip');
    },
  },
  enabled: (deps, _at, _carried, params) => {
    const needs = requiresOperands(deps);
    if (needs !== true) return needs;
    if (!deps?.scene) return ActionDisabledReason.NotApplicable;
    return transformAnswer(deps, deps.scene, flipOpsFor(deps, deps.operands!, deps.scene, params), 'Flip');
  },
});

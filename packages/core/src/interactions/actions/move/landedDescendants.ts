import type { NodeId, Scene } from 'core/scene/types';
import type { Op } from 'core/ops/types';
import { createTransformOp } from 'core/ops/transform';
import { translatePoseViaDescriptor, type PoseDescriptor } from 'core/geometry/poseDescriptor';
import { carriedDescendants, sceneCarrySource } from 'core/scene/carryDescendants';

/** What a move gesture captured at its start, as this pass reads it. */
export interface LandedDescendantsInput {
  scene: Scene<unknown, string, unknown>;
  projection: PoseDescriptor<unknown>;
  /** Start pose of every root and descendant. */
  startPoses: ReadonlyMap<NodeId, unknown>;
  label: string;
}

/**
 * Ops that bring along the descendants of every node `ops` transforms. A
 * layout drop or a behavior places a dragged root somewhere the drag delta
 * does not describe, and a layout shifts siblings to make room, so each
 * descendant moves by its nearest transformed ancestor's landed pose less
 * that ancestor's start pose. A descendant `ops` already writes, or that a
 * moving frame carries, is left alone.
 */
export function landedDescendantOps(input: LandedDescendantsInput, ops: readonly Op[]): Op[] {
  const { scene, projection, startPoses, label } = input;
  const landed = new Map<NodeId, { from: unknown; to: unknown }>();
  for (const op of ops) {
    if (op.name !== 'transform') continue;
    const a = op.args as { id: string; from: unknown; to: unknown };
    const id = a.id as NodeId;
    landed.set(id, { from: landed.get(id)?.from ?? startPoses.get(id) ?? a.from, to: a.to });
  }
  const source = sceneCarrySource(scene);
  const out: Op[] = [];
  for (const [root, { from, to }] of landed) {
    if (from === undefined || to === undefined) continue;
    const a = projection.getBounds(from);
    const b = projection.getBounds(to);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (dx === 0 && dy === 0) continue;
    const carried = carriedDescendants(
      source,
      root,
      (pose) => translatePoseViaDescriptor(pose, dx, dy, projection),
      (id) => landed.has(id),
    );
    for (const [id, pose] of carried) {
      const node = scene.get(id);
      if (node) out.push(createTransformOp<unknown>({ id, from: node.pose, to: pose, label }));
    }
  }
  return out;
}

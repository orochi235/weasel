import type { NodeId, Scene } from 'core/scene/types';
import type { Op } from 'core/ops/types';
import { createTransformOp } from 'core/ops/transform';
import { translatePoseViaDescriptor, type PoseDescriptor } from 'core/geometry/poseDescriptor';
import { subtreeIds } from '../selectionSubtree';

/** What a move gesture captured at its start, as this pass reads it. */
export interface LandedDescendantsInput {
  scene: Scene<unknown, string, unknown>;
  projection: PoseDescriptor<unknown>;
  /** The dragged roots. */
  roots: readonly NodeId[];
  /** Start pose of every root and descendant. */
  startPoses: ReadonlyMap<NodeId, unknown>;
  /** Descendants stored in a moving node's frame, which that node carries. */
  carried: ReadonlySet<NodeId>;
  label: string;
}

/**
 * Ops that bring each dragged root's descendants along to wherever `ops` put
 * the root. A layout drop or a behavior places the root itself, somewhere the
 * drag delta does not describe, so each descendant moves by its root's landed
 * pose less its start pose. A descendant `ops` already writes, or that a
 * moving frame carries, is left alone.
 */
export function landedDescendantOps(input: LandedDescendantsInput, ops: readonly Op[]): Op[] {
  const { scene, projection, startPoses, carried, label } = input;
  const landed = new Map<string, unknown>();
  for (const op of ops) {
    if (op.name !== 'transform') continue;
    const a = op.args as { id: string; to: unknown };
    landed.set(a.id, a.to);
  }
  const out: Op[] = [];
  for (const root of input.roots) {
    const to = landed.get(root);
    const start = startPoses.get(root);
    if (to === undefined || start === undefined) continue;
    const a = projection.getBounds(start);
    const b = projection.getBounds(to);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (dx === 0 && dy === 0) continue;
    for (const id of subtreeIds(scene, root)) {
      if (id === root || landed.has(id) || carried.has(id)) continue;
      const node = scene.get(id);
      if (!node) continue;
      out.push(createTransformOp<unknown>({
        id,
        from: node.pose,
        to: translatePoseViaDescriptor(node.pose, dx, dy, projection),
        label,
      }));
    }
  }
  return out;
}

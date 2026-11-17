import type { Op } from './types';
import { sameValue } from '../scene/sameValue';
import { alreadyHolds } from './alreadyHolds';
import { registerKitOpFactory } from './registry';

interface SetPoseAdapter<TPose> {
  setPose(id: string, pose: TPose): void;
}

/** Arguments to {@link createSetPoseOp}: replace node `id`'s pose `from` → `to`. */
export interface SetPoseArgs<TPose> {
  id: string;
  from: TPose;
  to: TPose;
  label?: string;
  coalesceKey?: string;
}

/** Op: set an object's pose, inverting back to `from`. `coalesceKey` defaults to
 *  `transform:${id}` so successive pose writes to the same node (drag-move,
 *  resize, repeated nudges) merge into one undo entry within the history's
 *  coalesce window. Pass an explicit key (or a unique one) to opt out. */
export function createSetPoseOp<TPose>(args: SetPoseArgs<TPose>): Op {
  const { id, from, to, label, coalesceKey = `transform:${id}` } = args;
  return {
    name: 'transform',
    args: { id, from, to, label, coalesceKey },
    label,
    coalesceKey,
    apply(adapter) {
      // Always call setPose so consumers that inspect op behavior (tests,
      // overlays) see a consistent "this op writes (id, to)" signal, and
      // report a no-op to history when the pose is already `to`. The node is
      // the answer where it can be read: a stated `from` can be stale.
      const held = alreadyHolds(adapter, id, (node) => sameValue(node.pose, to)) ?? poseShallowEqual(from, to);
      (adapter as SetPoseAdapter<TPose>).setPose(id, to);
      return held ? false : undefined;
    },
    invert() {
      return createSetPoseOp<TPose>({ id, from: to, to: from, label, coalesceKey });
    },
  };
}

registerKitOpFactory<SetPoseArgs<unknown>>('transform', (args) => createSetPoseOp(args));

function poseShallowEqual<TPose>(a: TPose, b: TPose): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (!Object.hasOwn(b as object, k) || (a as Record<string, unknown>)[k] !== (b as Record<string, unknown>)[k]) return false;
  }
  return true;
}

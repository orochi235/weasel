import type { Op } from './types';

interface TransformAdapter<TPose> {
  setPose(id: string, pose: TPose): void;
}

/** Op: set an object's pose, inverting back to `from`. Optionally tag with `coalesceKey` for batch merging. */
export function createTransformOp<TPose>(args: {
  id: string;
  from: TPose;
  to: TPose;
  label?: string;
  coalesceKey?: string;
}): Op {
  const { id, from, to, label, coalesceKey } = args;
  return {
    label,
    coalesceKey,
    apply(adapter) {
      // Self-report no-op when from and to are structurally identical so
      // the history layer can skip pushing the entry. The shallow-equal
      // covers the common case (Pose / RotatedPose record); for richer
      // TPose shapes the worst case is a redundant push (correctness is
      // preserved either way).
      if (poseShallowEqual(from, to)) return false;
      (adapter as TransformAdapter<TPose>).setPose(id, to);
      return undefined;
    },
    invert() {
      return createTransformOp<TPose>({ id, from: to, to: from, label, coalesceKey });
    },
  };
}

function poseShallowEqual<TPose>(a: TPose, b: TPose): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if ((a as Record<string, unknown>)[k] !== (b as Record<string, unknown>)[k]) return false;
  }
  return true;
}

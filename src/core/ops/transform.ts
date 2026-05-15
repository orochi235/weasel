import type { Op } from './types';
import { registerOpFactory } from './registry';

interface TransformAdapter<TPose> {
  setPose(id: string, pose: TPose): void;
}

/** @internal */
interface TransformArgs<TPose> {
  id: string;
  from: TPose;
  to: TPose;
  label?: string;
  coalesceKey?: string;
}

/** Op: set an object's pose, inverting back to `from`. Optionally tag with `coalesceKey` for batch merging. */
export function createTransformOp<TPose>(args: TransformArgs<TPose>): Op {
  const { id, from, to, label, coalesceKey } = args;
  return {
    name: 'transform',
    args: { id, from, to, label, coalesceKey },
    label,
    coalesceKey,
    apply(adapter) {
      // Always call setPose so consumers that inspect op behavior (tests,
      // overlays) see a consistent "this op writes (id, to)" signal. When
      // from and to are structurally identical, additionally report a
      // no-op to history so the entry can be skipped from the undo stack.
      // setPose(id, to) is idempotent in this branch — adapters write the
      // same pose they already had.
      (adapter as TransformAdapter<TPose>).setPose(id, to);
      if (poseShallowEqual(from, to)) return false;
      return undefined;
    },
    invert() {
      return createTransformOp<TPose>({ id, from: to, to: from, label, coalesceKey });
    },
  };
}

registerOpFactory<TransformArgs<unknown>>('transform', (args) => createTransformOp(args));

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

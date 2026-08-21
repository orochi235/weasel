import { createTransformOp } from 'core/ops/transform';
import type { LayoutSnap, LayoutStrategy } from '../types';
import { none } from '../snaps';

/** Options for `freeform`. */
export interface FreeformOptions<TPose> {
  snap?: LayoutSnap<TPose>;
}

/**
 * Identity layout: each child stays where it's stored, no reflow, no drop
 * targets. `snap` is accepted for API symmetry — overrides take effect only
 * if a caller wires up an external drop-target source, since `getDropTargets`
 * returns empty by default.
 */
export function freeform<TPose>(opts: FreeformOptions<TPose> = {}): LayoutStrategy<TPose> {
  const snap = opts.snap ?? none<TPose>();

  return {
    snap,

    childPoses(_container, children) {
      const out = new Map<string, TPose>();
      for (const c of children) out.set(c.id, c.pose);
      return out;
    },

    getDropTargets() {
      return [];
    },

    reflowPoses() {
      return new Map();
    },

    commitDrop(_container, _children, dragged, target) {
      return [
        createTransformOp<TPose>({
          id: dragged.id,
          from: dragged.originPose,
          to: target?.pose ?? dragged.pose,
          label: 'Drop',
        }),
      ];
    },
  };
}

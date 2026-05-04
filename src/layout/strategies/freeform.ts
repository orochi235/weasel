import { createTransformOp } from '../../core/ops/transform';
import type { LayoutSnap, LayoutStrategy } from '../types';
import { none } from '../snaps';

export interface FreeformOptions<TPose> {
  snap?: LayoutSnap<TPose>;
}

export function freeform<TPose>(opts: FreeformOptions<TPose> = {}): LayoutStrategy<TPose> {
  const snap = opts.snap ?? none<TPose>();

  return {
    snap,

    getChildPositions(_container, children) {
      const out = new Map<string, TPose>();
      for (const c of children) out.set(c.id, c.pose);
      return out;
    },

    getDropTargets() {
      return [];
    },

    reflowFor() {
      return new Map();
    },

    commitDrop(_container, _children, dragged, _target) {
      return [
        createTransformOp<TPose>({
          id: dragged.id,
          from: dragged.originPose,
          to: dragged.pose,
          label: 'Drop',
        }),
      ];
    },
  };
}

import { worldPoseLookup } from './composePose';
import type { PoseDescriptor } from 'core/geometry/poseDescriptor';
import { AUTO_POSE_DESCRIPTOR } from 'interactions/actions/resize/autoPoseDescriptor';

/** @internal */
interface HitAdapter<TNode extends { id: string }, TPose> {
  getNode: (id: string) => TNode | undefined;
  getNodes: () => TNode[];
  getPose: (id: string) => TPose;
  getParent: (id: string) => string | null;
}

/** Options for `nestedHitTester`. */
export interface NestedHitOpts<TNode extends { id: string }, TPose> {
  /** Compose a child's local pose into world coords given its parent's world
   *  pose. Same shape as `composeRectPose` (the default expectation). */
  composePose: (parent: TPose, child: TPose) => TPose;
  /** How to read world poses. Default `AUTO_POSE_DESCRIPTOR`. */
  poseDescriptor?: PoseDescriptor<TPose>;
  /** Predicate for "this object is a nesting parent body". The leaf scan
   *  skips objects for which this returns true so a click on a parent's
   *  painted body resolves to a child leaf, not the parent itself. Default:
   *  never (treat every object as hittable). */
  isGroup?: (id: string, obj: TNode | undefined) => boolean;
}

/** Hit-test entry points for a nested scene: one that always picks the
 *  outermost ancestor, and one that steps deeper on alt-click. */
export interface NestedHitTester {
  /** Outermost-ancestor pick. Suitable as the chrome-level `pickEvery`: a
   *  casual click selects the whole top-level ancestor. Returns `null` on
   *  empty space. */
  pickOutermost: (worldX: number, worldY: number) => string | null;
  /** Alt-aware selection-update pick. Without `alt`, returns the outermost
   *  ancestor (same as `pickOutermost`). With `alt`, returns one level
   *  deeper than the deepest currently-selected ancestor in the leaf's
   *  chain — repeated alt-clicks step ancestor → descendant → leaf. With
   *  `alt` and nothing in the chain selected, jumps straight to the leaf.
   *  Plug into `useSelectTool({ pickBest })`. */
  pickBest: (
    worldX: number,
    worldY: number,
    alt: boolean,
    selection: readonly string[],
  ) => string | null;
}

/** Build hit-testers that respect containers: a plain click selects the
 *  top-level ancestor, and alt-clicking descends one level at a time toward
 *  the leaf actually under the pointer. */
export function nestedHitTester<TNode extends { id: string }, TPose>(
  adapter: HitAdapter<TNode, TPose>,
  opts: NestedHitOpts<TNode, TPose>,
): NestedHitTester {
  const d = (opts.poseDescriptor ?? AUTO_POSE_DESCRIPTOR) as PoseDescriptor<TPose>;
  const isGroup = opts.isGroup ?? (() => false);
  const worldOf = worldPoseLookup(adapter, opts.composePose);

  const ancestorChain = (id: string): string[] => {
    const chain: string[] = [];
    let cur: string | null = id;
    while (cur !== null) {
      chain.unshift(cur);
      cur = adapter.getParent(cur);
    }
    return chain;
  };

  const hitLeaf = (wx: number, wy: number): string | null => {
    const objs = adapter.getNodes();
    for (let i = objs.length - 1; i >= 0; i--) {
      const o = objs[i];
      if (isGroup(o.id, o)) continue;
      const w = worldOf(o.id);
      if (!w) continue;
      const b = d.getBounds(w);
      if (wx >= b.x && wx <= b.x + b.width && wy >= b.y && wy <= b.y + b.height) {
        return o.id;
      }
    }
    return null;
  };

  const pickOutermost = (wx: number, wy: number): string | null => {
    const leaf = hitLeaf(wx, wy);
    return leaf === null ? null : ancestorChain(leaf)[0];
  };

  const pickBest = (
    wx: number,
    wy: number,
    alt: boolean,
    selection: readonly string[],
  ): string | null => {
    const leaf = hitLeaf(wx, wy);
    if (leaf === null) return null;
    const chain = ancestorChain(leaf);
    if (!alt) return chain[0];
    for (let i = chain.length - 1; i >= 0; i--) {
      if (selection.includes(chain[i])) {
        return chain[Math.min(i + 1, chain.length - 1)];
      }
    }
    return chain[chain.length - 1];
  };

  return { pickOutermost, pickBest };
}

import { worldPoseLookup } from 'features/groups/composePose';

interface RectBounds { x: number; y: number; width: number; height: number }

interface HitAdapter<TObject extends { id: string }, TPose> {
  getObject: (id: string) => TObject | undefined;
  getObjects: () => TObject[];
  getPose: (id: string) => TPose;
  getParent: (id: string) => string | null;
}

export interface NestedGroupHitOpts<TObject extends { id: string }, TPose> {
  /** Compose a child's local pose into world coords given its parent's world
   *  pose. Same shape as `composeRectPose` (the default expectation). */
  composePose: (parent: TPose, child: TPose) => TPose;
  /** Derive an axis-aligned bounding rect from a (world-space) pose. Default
   *  reads `x` / `y` / `width` / `height` straight off the pose (matches
   *  `RectPose`). Override for non-rect poses (e.g. paths). */
  poseBounds?: (pose: TPose) => RectBounds;
  /** Predicate for "this object is a group body". The leaf scan skips objects
   *  for which this returns true so a click on a group's painted body resolves
   *  to a child leaf, not the group itself. Default: never (treat every object
   *  as hittable). */
  isGroup?: (id: string, obj: TObject | undefined) => boolean;
}

export interface NestedGroupHitTester {
  /** Outermost-ancestor pick. Suitable as the chrome-level `pickEvery`: a
   *  casual click selects the whole top-level group. Returns `null` on
   *  empty space. */
  pickOutermost: (worldX: number, worldY: number) => string | null;
  /** Alt-aware selection-update pick. Without `alt`, returns the outermost
   *  ancestor (same as `pickOutermost`). With `alt`, returns one level
   *  deeper than the deepest currently-selected ancestor in the leaf's
   *  chain — repeated alt-clicks step group → subgroup → leaf. With `alt`
   *  and nothing in the chain selected, jumps straight to the leaf.
   *  Plug into `useSelectTool({ pickBest })`. */
  pickBest: (
    worldX: number,
    worldY: number,
    alt: boolean,
    selection: readonly string[],
  ) => string | null;
}

const defaultPoseBounds = <TPose>(pose: TPose): RectBounds => {
  const p = pose as unknown as RectBounds;
  return { x: p.x, y: p.y, width: p.width, height: p.height };
};

export function nestedGroupHitTester<TObject extends { id: string }, TPose>(
  adapter: HitAdapter<TObject, TPose>,
  opts: NestedGroupHitOpts<TObject, TPose>,
): NestedGroupHitTester {
  const poseBounds = opts.poseBounds ?? defaultPoseBounds<TPose>;
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
    const objs = adapter.getObjects();
    for (let i = objs.length - 1; i >= 0; i--) {
      const o = objs[i];
      if (isGroup(o.id, o)) continue;
      const w = worldOf(o.id);
      if (!w) continue;
      const b = poseBounds(w);
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

/**
 * Pick the topmost id from a body-hit list, using whatever signal the
 * adapter exposes.
 *
 * Why this exists: `pickEvery` returns every id whose body covers the pointer.
 * Naively taking `ids[0]` makes containers swallow clicks on their children
 * (the container's bounds also cover the hit point, and demo iteration
 * order tends to put parents before children). This helper resolves the
 * ambiguity in a way that's correct by default for the common parent/child
 * case, while remaining a no-op for the trivial single-hit case.
 *
 * Resolution rules (in order):
 *
 * 1. **Empty / single hit.** Return `null` / the lone id.
 * 2. **Parent/child collapse.** When `adapter.getParent` is present, drop
 *    any id in the hit set that is an ancestor of another id in the hit
 *    set. After the collapse, if exactly one id remains, return it.
 * 3. **Sibling z-order.** When the adapter exposes `compareZ` or `getZIndex`,
 *    the survivors of the collapse are ranked by it and the highest wins.
 *    This composes with step 2 rather than replacing it: a child still beats
 *    its own ancestor regardless of what z the two report.
 * 4. **Tiebreaker.** Return the LAST id in the (collapsed) array. Scenes
 *    walked forward (`renderOrder()`, `Object.keys`, `for of items`) come
 *    back bottom-first by convention, so "last" gives the topmost. A caller
 *    that z-sorts topmost-first and exposes neither z hook should resolve
 *    before calling — this helper doesn't try to detect that.
 */
export interface PickTopMostHitAdapter {
  getParent?: (id: string) => string | null;
  /** Paint depth of `id`; higher draws later, so higher wins a hit. Ids the
   *  adapter doesn't know sort below every id it does. */
  getZIndex?: (id: string) => number | null | undefined;
  /** Full ordering, for scenes whose depth isn't a number (a path through a
   *  tree, say). Negative when `a` paints below `b`. Takes precedence over
   *  `getZIndex` when both are present. */
  compareZ?: (a: string, b: string) => number;
}

export function pickTopMostHit(
  ids: readonly string[],
  adapter: PickTopMostHitAdapter | undefined | null,
): string | null {
  if (ids.length === 0) return null;
  if (ids.length === 1) return ids[0];

  let candidates = ids;

  const getParent = adapter?.getParent;
  if (typeof getParent === 'function') {
    const set = new Set(ids);
    const dropped = new Set<string>();
    for (const id of ids) {
      let p: string | null = getParent(id);
      // Cap walk to avoid pathological cycles in malformed adapters.
      let depth = 0;
      while (p != null && depth++ < 10_000) {
        if (set.has(p)) dropped.add(p);
        p = getParent(p);
      }
    }
    if (dropped.size > 0) {
      const filtered = ids.filter((id) => !dropped.has(id));
      // A pathological adapter (cyclic `getParent`) can drop everything;
      // keep the original array rather than answering null.
      if (filtered.length === 1) return filtered[0];
      if (filtered.length > 1) candidates = filtered;
    }
  }

  return pickHighestZ(candidates, adapter);
}

/** Highest-z survivor, or the last one when the adapter exposes no z signal.
 *  Scanning forward and taking strictly-greater makes the array's own order
 *  the tiebreaker, so equal-z ids resolve the same way as no-z ones. */
function pickHighestZ(
  ids: readonly string[],
  adapter: PickTopMostHitAdapter | undefined | null,
): string {
  const compareZ = adapter?.compareZ;
  if (typeof compareZ === 'function') {
    let best = ids[0];
    for (let i = 1; i < ids.length; i++) {
      if (compareZ(ids[i], best) >= 0) best = ids[i];
    }
    return best;
  }

  const getZIndex = adapter?.getZIndex;
  if (typeof getZIndex === 'function') {
    let best = ids[0];
    let bestZ = zOf(getZIndex, best);
    for (let i = 1; i < ids.length; i++) {
      const z = zOf(getZIndex, ids[i]);
      if (z >= bestZ) { best = ids[i]; bestZ = z; }
    }
    return best;
  }

  return ids[ids.length - 1];
}

function zOf(getZIndex: (id: string) => number | null | undefined, id: string): number {
  const z = getZIndex(id);
  return typeof z === 'number' && Number.isFinite(z) ? z : -Infinity;
}

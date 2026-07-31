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
 * 3. **Tiebreaker.** Return the LAST id in the (collapsed) array. Demos
 *    that walk their scene forward (`Object.keys`, `for of items`) return
 *    bottom-first by convention; "last" gives the topmost. Demos that
 *    already z-sort with topmost first should pass an array of length 1
 *    (resolve before calling) — this helper doesn't try to detect that.
 *
 * Pure sibling z-order without a parent/child relation is not resolved
 * here yet — see "Sibling z-order is unresolved in hit-picking" under
 * Tools & gestures in `docs/TODO.md`. The shape it wants is an optional
 * `getZIndex` / `compareZ` on the adapter below, composing with the
 * parent/child collapse rather than replacing it.
 */
export interface PickTopMostHitAdapter {
  getParent?: (id: string) => string | null;
}

export function pickTopMostHit(
  ids: readonly string[],
  adapter: PickTopMostHitAdapter | undefined | null,
): string | null {
  if (ids.length === 0) return null;
  if (ids.length === 1) return ids[0];

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
      if (filtered.length === 0) {
        // Pathological adapter (e.g. cyclic getParent dropped everything).
        // Fall through to the original-array fallback.
      } else if (filtered.length === 1) {
        return filtered[0];
      } else {
        return filtered[filtered.length - 1];
      }
    }
  }

  return ids[ids.length - 1];
}

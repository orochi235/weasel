import { locateAnchor, type AnchorSet } from './anchorEdits';
import { simplifySpan, simplifySubpath, type SimplifyPathOptions } from './simplifyPath';

/**
 * Simplify only where `flatIndexes` say: each unbroken run of those anchors
 * along a subpath is refitted as one span by the fitter {@link simplifyPath}
 * uses (`simplifySpan`), so only anchors the shape does not need, within
 * `tolerance`, go. A run's first and last anchors stay, and every anchor
 * outside a run is left as it was. A closed subpath named whole is simplified
 * whole. Answers whether any anchor went; a run the fit cannot thin is left
 * untouched.
 */
export function simplifyAnchorsAt(
  set: AnchorSet,
  flatIndexes: Iterable<number>,
  tolerance: number,
  opts: SimplifyPathOptions = {},
): boolean {
  const bySub = new Map<number, Set<number>>();
  for (const flat of flatIndexes) {
    const loc = locateAnchor(set, flat);
    if (!loc) continue;
    const named = bySub.get(loc.sub) ?? new Set<number>();
    named.add(loc.idx);
    bySub.set(loc.sub, named);
  }
  let changed = false;
  for (const [s, named] of bySub) {
    const sub = set.anchors[s];
    const closed = set.closed[s];
    if (closed && named.size === sub.length) {
      const next = simplifySubpath(sub, true, tolerance, opts);
      if (next.length < sub.length) { set.anchors[s] = next; changed = true; }
      continue;
    }
    // Start a closed subpath on an anchor outside every run, so none wraps.
    const shift = closed ? [...sub.keys()].find((i) => !named.has(i))! : 0;
    const order = closed ? [...sub.slice(shift), ...sub.slice(0, shift)] : sub;
    const inRun = (i: number) => named.has((i + shift) % sub.length);
    const out = order.slice();
    let thinned = false;
    // Back to front, so a splice leaves the runs before it where they were.
    for (let end = order.length - 1; end >= 0; end--) {
      if (!inRun(end)) continue;
      let start = end;
      while (start > 0 && inRun(start - 1)) start--;
      if (end - start >= 2) {
        const refit = simplifySpan(order, closed, start, end, tolerance, opts);
        if (refit.length < end - start + 1) {
          out.splice(start, end - start + 1, ...refit);
          thinned = true;
        }
      }
      end = start;
    }
    if (thinned) { set.anchors[s] = out; changed = true; }
  }
  return changed;
}

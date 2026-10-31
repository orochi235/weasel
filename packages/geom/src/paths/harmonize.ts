import { anchorCount, locateAnchor, type AnchorSet } from './anchorEdits';
import { isAnchorSmooth, type PenAnchor } from './anchors';

type Point = { x: number; y: number };

/** Passes over the anchors before giving up on settling. Each anchor's fix
 *  moves its neighbors' curvature a little, so a few passes are needed. */
const MAX_PASSES = 64;
/** A pass that moves no handle further than this fraction of its length has
 *  settled. */
const SETTLED = 1e-12;
/** Handles that end up no further than this fraction of their length from
 *  where they started count as unchanged. */
const UNCHANGED = 1e-4;
/** Nor further than this many single-precision steps at the handle's
 *  coordinates: a stored path comes back that far off the harmony it was
 *  given, and re-solving it lands about 1e-4 away at document scale. */
const UNCHANGED_STEPS = 64;

/**
 * Make each smooth anchor at `flatIndexes` curvature-continuous: the curve
 * bends as tightly just after the anchor as just before it, so it shows no
 * kink in its curvature there. Only handle lengths change — each handle keeps
 * its direction, so the anchor stays smooth and the tangent stays put — and
 * the product of the two lengths is kept, so the anchor's pull on the curve
 * stays about as strong.
 *
 * Absent `flatIndexes`, every anchor in the set. Moving one anchor's handles
 * changes the curvature at its neighbors, so the fixes are repeated until
 * they settle.
 *
 * Skipped, because lengths alone cannot do it: a corner, an anchor missing a
 * handle, an end of an open subpath, and an anchor the curve bends opposite
 * ways either side of, or straight through on one side.
 *
 * Returns false when nothing changed.
 */
export function harmonizeAnchors(set: AnchorSet, flatIndexes?: Iterable<number>): boolean {
  const targets = flatIndexes
    ? [...new Set(flatIndexes)]
    : Array.from({ length: anchorCount(set) }, (_, i) => i);
  const located = targets
    .map((flat) => locateAnchor(set, flat))
    .filter((loc): loc is { sub: number; idx: number } => loc !== null);
  const anchors = located.map(({ sub, idx }) => set.anchors[sub][idx]);
  const before = anchors.map((a) => ({ inHandle: a.inHandle, outHandle: a.outHandle }));
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let moved = 0;
    for (const { sub, idx } of located) moved = Math.max(moved, harmonizeOne(set, sub, idx));
    if (moved <= SETTLED) break;
  }
  const changed = anchors.some((a, i) =>
    movedFar(a, before[i].inHandle, a.inHandle) || movedFar(a, before[i].outHandle, a.outHandle));
  if (!changed) {
    anchors.forEach((a, i) => { a.inHandle = before[i].inHandle; a.outHandle = before[i].outHandle; });
  }
  return changed;
}

function movedFar(a: Point, from: Point | undefined, to: Point | undefined): boolean {
  if (!from || !to || from === to) return false;
  const len = Math.hypot(from.x - a.x, from.y - a.y);
  const magnitude = Math.max(Math.abs(from.x), Math.abs(from.y), Math.abs(a.x), Math.abs(a.y));
  const tolerance = Math.max(UNCHANGED * len, UNCHANGED_STEPS * magnitude * 2 ** -23, 1e-9);
  return Math.hypot(to.x - from.x, to.y - from.y) > tolerance;
}

/** Harmonize one anchor; returns how far its handles moved, relative to
 *  their lengths. */
function harmonizeOne(set: AnchorSet, sub: number, idx: number): number {
  const anchors = set.anchors[sub];
  const closed = set.closed[sub];
  const n = anchors.length;
  if (!closed && (idx === 0 || idx === n - 1)) return 0;
  if (n < 2) return 0;
  const a = anchors[idx];
  if (!isAnchorSmooth(a)) return 0;
  const prev = anchors[(idx - 1 + n) % n];
  const next = anchors[(idx + 1) % n];

  const hIn = Math.hypot(a.inHandle!.x - a.x, a.inHandle!.y - a.y);
  const hOut = Math.hypot(a.outHandle!.x - a.x, a.outHandle!.y - a.y);
  const u = { x: (a.outHandle!.x - a.x) / hOut, y: (a.outHandle!.y - a.y) / hOut };

  // Curvature at the anchor is 2/3 · d / h², where h is the handle's length
  // and d how far the far control of that segment sits off the tangent line.
  const dIn = offTangent(a, u, prev.outHandle ?? prev);
  const dOut = offTangent(a, u, next.inHandle ?? next);
  if (dIn === 0 || dOut === 0 || Math.sign(dIn) !== Math.sign(dOut)) return 0;

  const ratio = Math.sqrt(dIn / dOut);
  const product = hIn * hOut;
  const nextIn = Math.sqrt(product * ratio);
  const nextOut = Math.sqrt(product / ratio);
  const moved = Math.max(Math.abs(nextIn - hIn) / hIn, Math.abs(nextOut - hOut) / hOut);
  if (moved <= SETTLED) return 0;
  a.inHandle = along(a, u, -nextIn);
  a.outHandle = along(a, u, nextOut);
  return moved;
}

/** Signed distance of `p` from the line through `a` along unit `u`. */
function offTangent(a: PenAnchor, u: Point, p: Point): number {
  const d = u.x * (p.y - a.y) - u.y * (p.x - a.x);
  return Math.abs(d) < 1e-12 ? 0 : d;
}

function along(a: PenAnchor, u: Point, len: number): Point {
  return { x: a.x + u.x * len, y: a.y + u.y * len };
}

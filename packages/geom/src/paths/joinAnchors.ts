/**
 * Average and Join: anchor-set edits that bring anchors together. Both mutate
 * the model `pathToAnchors` produces in place, like the edits in
 * `anchorEdits`, and address anchors by flat index.
 */

import type { PenAnchor } from './anchors';
import { locateAnchor, translateAnchorBy, type AnchorSet } from './anchorEdits';

/** Which coordinates {@link averageAnchorsAt} averages: `'x'` lines the
 *  anchors up on one vertical, `'y'` on one horizontal, `'both'` stacks them
 *  on one point. */
export type AverageAxis = 'x' | 'y' | 'both';

/** One end of an open subpath. */
export interface SubpathEnd {
  sub: number;
  end: 'first' | 'last';
}

/** Endpoints closer than this are one point, and joining them merges them. */
const COINCIDENT = 1e-6;

/** How {@link joinSubpathEnds} spans the gap between two ends apart. */
export interface JoinOptions {
  /** Absent, a straight segment. Given, a curve leaving each end along the
   *  direction its path was heading there, each handle `tension` times the
   *  gap long; `0` is a straight segment. */
  tension?: number;
}

/**
 * Move each anchor in `flatIndexes` to their mean position, along `axis`.
 * Each anchor carries its handles with it. Returns false, changing nothing,
 * when fewer than two of the indexes name anchors.
 */
export function averageAnchorsAt(set: AnchorSet, flatIndexes: Iterable<number>, axis: AverageAxis = 'both'): boolean {
  const picked: { flat: number; a: PenAnchor }[] = [];
  for (const flat of new Set(flatIndexes)) {
    const loc = locateAnchor(set, flat);
    if (loc) picked.push({ flat, a: set.anchors[loc.sub][loc.idx] });
  }
  if (picked.length < 2) return false;
  const mx = picked.reduce((s, p) => s + p.a.x, 0) / picked.length;
  const my = picked.reduce((s, p) => s + p.a.y, 0) / picked.length;
  for (const { flat, a } of picked) {
    translateAnchorBy(set, flat, axis === 'y' ? 0 : mx - a.x, axis === 'x' ? 0 : my - a.y);
  }
  return true;
}

/** The open-subpath end anchor `flatIndex` names, or null for an interior
 *  anchor or one on a closed subpath. A lone anchor reads as `'last'`. */
export function subpathEndAt(set: AnchorSet, flatIndex: number): SubpathEnd | null {
  const loc = locateAnchor(set, flatIndex);
  if (!loc || set.closed[loc.sub]) return null;
  const len = set.anchors[loc.sub].length;
  if (loc.idx === len - 1) return { sub: loc.sub, end: 'last' };
  if (loc.idx === 0) return { sub: loc.sub, end: 'first' };
  return null;
}

/**
 * Join the two open-subpath ends `a` and `b`. The two ends of one subpath
 * close it; ends of two subpaths make one subpath, `a`'s run followed by
 * `b`'s, in the slot of whichever came first. Ends that coincide merge into
 * one anchor, keeping the handle on either side; ends apart are bridged by a
 * straight segment, or with `options.tension` by a curve meeting each end
 * tangentially. Returns false, changing nothing, when the ends are not two
 * distinct ends of open subpaths.
 */
export function joinSubpathEnds(set: AnchorSet, a: SubpathEnd, b: SubpathEnd, options: JoinOptions = {}): boolean {
  const subA = set.anchors[a.sub];
  const subB = set.anchors[b.sub];
  if (!subA || !subB || set.closed[a.sub] || set.closed[b.sub]) return false;
  if (a.sub === b.sub) {
    if (a.end === b.end || subA.length < 2) return false;
    const first = subA[0];
    const last = subA[subA.length - 1];
    if (coincide(first, last) && subA.length > 2) {
      if (last.inHandle) first.inHandle = last.inHandle;
      subA.pop();
    } else if (options.tension !== undefined) {
      bridge(subA, subA, options.tension);
    }
    set.closed[a.sub] = true;
    return true;
  }
  if (a.end === 'first') reverseInPlace(subA);
  if (b.end === 'last') reverseInPlace(subB);
  const tail = subA[subA.length - 1];
  const head = subB[0];
  let joined: PenAnchor[];
  if (coincide(tail, head)) {
    if (head.outHandle) tail.outHandle = head.outHandle;
    joined = [...subA, ...subB.slice(1)];
  } else {
    if (options.tension !== undefined) bridge(subA, subB, options.tension);
    joined = [...subA, ...subB];
  }
  const keep = Math.min(a.sub, b.sub);
  const drop = Math.max(a.sub, b.sub);
  set.anchors[keep] = joined;
  set.anchors.splice(drop, 1);
  set.closed.splice(drop, 1);
  return true;
}

/** {@link joinSubpathEnds} for two anchors named by flat index, each the end
 *  of an open subpath. */
export function joinAnchorsAt(set: AnchorSet, flatA: number, flatB: number, options: JoinOptions = {}): boolean {
  if (flatA === flatB) return false;
  const a = subpathEndAt(set, flatA);
  const b = subpathEndAt(set, flatB);
  if (!a || !b) return false;
  return joinSubpathEnds(set, a, b, options);
}

/**
 * The two open-subpath ends nearest each other that `accept` allows, on two
 * different subpaths. Null when there are no two such subpaths.
 */
export function closestOpenEnds(
  set: AnchorSet,
  accept: (a: SubpathEnd, b: SubpathEnd) => boolean = () => true,
): [SubpathEnd, SubpathEnd] | null {
  const ends: { end: SubpathEnd; at: PenAnchor }[] = [];
  set.anchors.forEach((sub, s) => {
    if (set.closed[s] || sub.length < 2) return;
    ends.push({ end: { sub: s, end: 'first' }, at: sub[0] });
    ends.push({ end: { sub: s, end: 'last' }, at: sub[sub.length - 1] });
  });
  let best: [SubpathEnd, SubpathEnd] | null = null;
  let bestD = Infinity;
  for (let i = 0; i < ends.length; i++) {
    for (let j = i + 1; j < ends.length; j++) {
      const p = ends[i], q = ends[j];
      if (p.end.sub === q.end.sub || !accept(p.end, q.end)) continue;
      const d = Math.hypot(p.at.x - q.at.x, p.at.y - q.at.y);
      if (d < bestD) { bestD = d; best = [p.end, q.end]; }
    }
  }
  return best;
}

const coincide = (p: PenAnchor, q: PenAnchor): boolean => Math.hypot(p.x - q.x, p.y - q.y) <= COINCIDENT;

type Vec = { x: number; y: number };

/** The unit vector from `from` to `to`, or null when they coincide. */
function unit(from: Vec, to: Vec): Vec | null {
  const d = Math.hypot(to.x - from.x, to.y - from.y);
  return d > COINCIDENT ? { x: (to.x - from.x) / d, y: (to.y - from.y) / d } : null;
}

/** The direction `sub` heads in at its last anchor: along the last segment's
 *  final tangent, from the nearest of its controls that is apart from it. */
function headingAtLast(sub: PenAnchor[]): Vec | null {
  const end = sub[sub.length - 1];
  const prev = sub.length > 1 ? sub[sub.length - 2] : null;
  for (const c of [end.inHandle, prev?.outHandle, prev]) {
    const u = c ? unit(c, end) : null;
    if (u) return u;
  }
  return null;
}

/** The direction `sub` heads in as it leaves its first anchor. */
function headingAtFirst(sub: PenAnchor[]): Vec | null {
  const start = sub[0];
  const next = sub.length > 1 ? sub[1] : null;
  for (const c of [start.outHandle, next?.inHandle, next]) {
    const u = c ? unit(start, c) : null;
    if (u) return u;
  }
  return null;
}

/**
 * Shape the segment from `from`'s last anchor to `to`'s first as a curve that
 * carries on from each: handles `tension` times the gap long, along the
 * heading of each path at its end. An end with no heading of its own (a lone
 * anchor) aims at the other end.
 */
function bridge(from: PenAnchor[], to: PenAnchor[], tension: number): void {
  const tail = from[from.length - 1];
  const head = to[0];
  const gap = Math.hypot(head.x - tail.x, head.y - tail.y);
  const chord = unit(tail, head);
  if (!chord || tension <= 0) return;
  const out = headingAtLast(from) ?? chord;
  const into = headingAtFirst(to) ?? chord;
  const len = tension * gap;
  tail.outHandle = { x: tail.x + out.x * len, y: tail.y + out.y * len };
  head.inHandle = { x: head.x - into.x * len, y: head.y - into.y * len };
}

/** Reverse `sub`'s direction keeping each anchor object, so origin tracking
 *  (`editAnchorSetTracked`) still recognizes them. */
function reverseInPlace(sub: PenAnchor[]): void {
  sub.reverse();
  for (const a of sub) {
    const { inHandle, outHandle } = a;
    delete a.inHandle;
    delete a.outHandle;
    if (outHandle) a.inHandle = outHandle;
    if (inHandle) a.outHandle = inHandle;
  }
}

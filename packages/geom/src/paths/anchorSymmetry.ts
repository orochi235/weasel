import { transformPoint, type Affine } from '../affine';
import { anchorAt, anchorCount, translateAnchorBy, type AnchorSet } from './anchorEdits';
import { isAnchorSmooth, type PenAnchor } from './anchors';
import { bendSegment, type BendGrip } from './bendSegment';
import type { Point } from './cubicMath';

type Side = 'in' | 'out';

/**
 * How a path maps onto itself under one transform `m`: `partners[i]` is the
 * flat index of the anchor that anchor `i` lands on, and `flips[i]` whether
 * its in-handle lands on that anchor's out-handle — a mirror reverses which
 * way a path runs, a rotation does not. An anchor `m` fixes is its own
 * partner.
 */
export interface AnchorSymmetry {
  readonly m: Affine;
  readonly partners: readonly number[];
  readonly flips: readonly boolean[];
}

function near(a: Point | undefined, b: Point | undefined, tol: number): boolean {
  if (!a || !b) return a === b;
  return Math.abs(a.x - b.x) <= tol && Math.abs(a.y - b.y) <= tol;
}

function image(m: Affine, p: Point): Point;
function image(m: Affine, p: Point | undefined): Point | undefined;
function image(m: Affine, p: Point | undefined): Point | undefined {
  if (!p) return undefined;
  const [x, y] = transformPoint(m, p.x, p.y);
  return { x, y };
}

function linear(m: Affine, d: Point): Point {
  return { x: m[0] * d.x + m[2] * d.y, y: m[1] * d.x + m[3] * d.y };
}

/** How `a` lands on `b` under `m`: `false` with the handles side for side,
 *  `true` with them swapped, `null` when it is not `b`'s image. Side for side
 *  is tried first, so an anchor with no handles is never a flip. */
function landing(m: Affine, a: PenAnchor, b: PenAnchor, tol: number): boolean | null {
  if (!near(image(m, a), b, tol)) return null;
  const i = image(m, a.inHandle);
  const o = image(m, a.outHandle);
  if (near(i, b.inHandle, tol) && near(o, b.outHandle, tol)) return false;
  if (near(i, b.outHandle, tol) && near(o, b.inHandle, tol)) return true;
  return null;
}

/**
 * The pairing that makes `set` its own image under `m`, or `null` when it is
 * not one: every anchor, handles included, must land on a distinct anchor
 * within `tolerance` on each axis.
 */
export function anchorSymmetry(set: AnchorSet, m: Affine, tolerance = 1e-6): AnchorSymmetry | null {
  const n = anchorCount(set);
  const partners: number[] = [];
  const flips: boolean[] = [];
  const taken = new Set<number>();
  for (let i = 0; i < n; i++) {
    const a = anchorAt(set, i)!;
    let found = -1;
    let flip = false;
    for (let j = 0; j < n && found < 0; j++) {
      if (taken.has(j)) continue;
      const how = landing(m, a, anchorAt(set, j)!, tolerance);
      if (how === null) continue;
      found = j;
      flip = how;
    }
    if (found < 0) return null;
    taken.add(found);
    partners.push(found);
    flips.push(flip);
  }
  return { m, partners, flips };
}

/** Every transform in `group` that `set` is its own image under, paired. */
export function anchorSymmetries(set: AnchorSet, group: readonly Affine[], tolerance = 1e-6): AnchorSymmetry[] {
  return group
    .map((m) => anchorSymmetry(set, m, tolerance))
    .filter((s): s is AnchorSymmetry => s !== null);
}

/**
 * `d` averaged over every transform in `syms` that fixes what `fixes` names,
 * and the identity: the part of the move that keeps it where those transforms
 * hold it. Exact when `syms` is a group less its identity — an anchor on a
 * mirror axis slides along it, an anchor at a center of rotation stays put.
 */
function averaged(d: Point, syms: readonly AnchorSymmetry[], fixes: (s: AnchorSymmetry) => boolean, apply: (m: Affine, p: Point) => Point): Point {
  let x = d.x;
  let y = d.y;
  let k = 1;
  for (const s of syms) {
    if (!fixes(s)) continue;
    const p = apply(s.m, d);
    x += p.x;
    y += p.y;
    k++;
  }
  return { x: x / k, y: y / k };
}

/**
 * Translate the anchors `flats` by `(dx, dy)` the way `translateAnchorBy`
 * does, and every image of each under `syms` by the transformed delta, so a
 * path that was its own image under each of them still is. `syms` should be
 * the whole symmetry group less its identity, as `anchorSymmetries` gives it
 * for a group; with a part of one, the anchors it fixes are only partly held.
 * An anchor that is itself being dragged moves as dragged.
 */
export function translateAnchorsSymmetric(
  set: AnchorSet,
  flats: readonly number[],
  dx: number,
  dy: number,
  syms: readonly AnchorSymmetry[],
): boolean {
  return translateEachSymmetric(set, new Map(flats.map((flat) => [flat, { x: dx, y: dy }])), syms);
}

/**
 * `translateAnchorsSymmetric` with a delta of its own for each anchor:
 * `deltas` maps a flat index to how far that anchor moves. An anchor that is
 * itself in `deltas` moves as asked, not as another's image.
 */
export function translateEachSymmetric(
  set: AnchorSet,
  deltas: ReadonlyMap<number, Point>,
  syms: readonly AnchorSymmetry[],
): boolean {
  const moves = new Map<number, Point>();
  for (const [flat, delta] of deltas) {
    const d = averaged(delta, syms, (s) => s.partners[flat] === flat, linear);
    moves.set(flat, d);
    for (const s of syms) {
      const j = s.partners[flat];
      if (j === undefined || deltas.has(j) || moves.has(j)) continue;
      moves.set(j, linear(s.m, d));
    }
  }
  let changed = false;
  for (const [flat, d] of moves) changed = translateAnchorBy(set, flat, d.x, d.y) || changed;
  return changed;
}

const other = (side: Side): Side => (side === 'in' ? 'out' : 'in');

/**
 * Move one handle to `(toX, toY)` and every image of it under `syms` to the
 * image of that point, so a path that was its own image under each of them
 * still is. A handle a transform maps onto itself keeps to where that
 * transform allows; one mapped onto its own anchor's opposite handle drives
 * that handle.
 *
 * Otherwise a smooth anchor keeps the opposite handle opposite, as
 * `moveHandleTo` does, unless `breakSmoothness`, and that handle's images
 * follow it. Every handle is written once, from its target, so no anchor
 * re-aims a handle another image already placed.
 */
export function moveHandleSymmetric(
  set: AnchorSet,
  flat: number,
  side: 'in' | 'out',
  toX: number,
  toY: number,
  breakSmoothness: boolean,
  syms: readonly AnchorSymmetry[],
): boolean {
  const a = anchorAt(set, flat);
  if (!a || !(side === 'in' ? a.inHandle : a.outHandle)) return false;
  const sideUnder = (s: AnchorSymmetry, sd: Side): Side => (s.flips[flat] ? other(sd) : sd);
  const fixesHandle = (s: AnchorSymmetry) => s.partners[flat] === flat && sideUnder(s, side) === side;
  const to = averaged({ x: toX, y: toY }, syms, fixesHandle, image);

  const targets = new Map<string, { flat: number; side: Side; to: Point }>();
  const put = (f: number, sd: Side, p: Point): void => {
    const key = `${f}:${sd}`;
    if (!targets.has(key)) targets.set(key, { flat: f, side: sd, to: p });
  };
  put(flat, side, to);
  for (const s of syms) put(s.partners[flat], sideUnder(s, side), image(s.m, to));

  const opposite = side === 'in' ? a.outHandle : a.inHandle;
  const drivenBySymmetry = targets.has(`${flat}:${other(side)}`);
  if (!drivenBySymmetry && !breakSmoothness && opposite && isAnchorSmooth(a)) {
    const opp = { x: 2 * a.x - to.x, y: 2 * a.y - to.y };
    put(flat, other(side), opp);
    for (const s of syms) put(s.partners[flat], sideUnder(s, other(side)), image(s.m, opp));
  }

  for (const t of targets.values()) {
    const b = anchorAt(set, t.flat);
    if (!b) continue;
    if (t.side === 'in') b.inHandle = t.to;
    else b.outHandle = t.to;
  }
  return true;
}

/** Flat index of anchor `idx` of subpath `sub`. */
function flatOf(set: AnchorSet, sub: number, idx: number): number {
  let flat = idx;
  for (let k = 0; k < sub; k++) flat += set.anchors[k].length;
  return flat;
}

/** Flat index of the anchor after `flat` along its subpath, or -1 at an open end. */
function nextFlat(set: AnchorSet, flat: number): number {
  let start = 0;
  for (let sub = 0; sub < set.anchors.length; sub++) {
    const len = set.anchors[sub].length;
    if (flat < start + len) {
      const idx = flat - start + 1;
      if (idx < len) return start + idx;
      return set.closed[sub] ? start : -1;
    }
    start += len;
  }
  return -1;
}

/**
 * Bend a segment as `bendSegment` does, and write each handle the bend moved
 * into its images under `syms`, so a path that was its own image under each of
 * them still is. A handle that is also the image of another moved handle, as on
 * a segment a mirror maps onto itself, takes the mean of its targets.
 */
export function bendSegmentSymmetric(
  set: AnchorSet,
  grip: BendGrip,
  dx: number,
  dy: number,
  syms: readonly AnchorSymmetry[],
): boolean {
  if (syms.length === 0) return bendSegment(set, grip, dx, dy);
  const ia = flatOf(set, grip.sub, grip.segIdx);
  const ib = nextFlat(set, ia);
  if (ib < 0) return false;
  const a = anchorAt(set, ia)!;
  const b = anchorAt(set, ib)!;
  const before = { a: { in: a.inHandle, out: a.outHandle }, b: { in: b.inHandle, out: b.outHandle } };
  if (!bendSegment(set, grip, dx, dy)) return false;

  const sums = new Map<string, { flat: number; side: Side; x: number; y: number; k: number }>();
  const add = (flat: number, side: Side, p: Point): void => {
    const key = `${flat}:${side}`;
    const sum = sums.get(key) ?? { flat, side, x: 0, y: 0, k: 0 };
    sum.x += p.x;
    sum.y += p.y;
    sum.k++;
    sums.set(key, sum);
  };
  // A transform reverses the segment when it lands a and b with b first; a bare anchor's own pairing can't say.
  const reverses = syms.map((s) => nextFlat(set, s.partners[ia]) !== s.partners[ib]);
  for (const [flat, anchor, was] of [[ia, a, before.a], [ib, b, before.b]] as const) {
    for (const side of ['in', 'out'] as const) {
      const now = side === 'in' ? anchor.inHandle : anchor.outHandle;
      if (!now || now === was[side]) continue;
      add(flat, side, now);
      syms.forEach((s, k) => add(s.partners[flat], reverses[k] ? other(side) : side, image(s.m, now)));
    }
  }
  for (const t of sums.values()) {
    const c = anchorAt(set, t.flat)!;
    const to = { x: t.x / t.k, y: t.y / t.k };
    if (t.side === 'in') c.inHandle = to;
    else c.outHandle = to;
  }
  return true;
}

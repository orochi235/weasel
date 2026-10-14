import { applyToPoint, type Affine } from '../affine';
import { anchorAt, anchorCount, moveHandleTo, translateAnchorBy, type AnchorSet } from './anchorEdits';
import type { PenAnchor } from './anchors';

type Pt = { x: number; y: number };

/** How a path maps onto itself under one mirror `m`: `partners[i]` is the flat
 *  index of the anchor that anchor `i` lands on. An anchor on the axis is its
 *  own partner. */
export interface AnchorMirror {
  readonly m: Affine;
  readonly partners: readonly number[];
}

function near(a: Pt | undefined, b: Pt | undefined, tol: number): boolean {
  if (!a || !b) return a === b;
  return Math.abs(a.x - b.x) <= tol && Math.abs(a.y - b.y) <= tol;
}

function image(m: Affine, p: Pt): Pt;
function image(m: Affine, p: Pt | undefined): Pt | undefined;
function image(m: Affine, p: Pt | undefined): Pt | undefined {
  if (!p) return undefined;
  const [x, y] = applyToPoint(m, p.x, p.y);
  return { x, y };
}

/** Whether `b` is `a`'s mirror image: the point, and the two handles as a pair
 *  in either order, since a mirror reverses which way a closed path runs. */
function mirrorsOnto(m: Affine, a: PenAnchor, b: PenAnchor, tol: number): boolean {
  if (!near(image(m, a), b, tol)) return false;
  const i = image(m, a.inHandle);
  const o = image(m, a.outHandle);
  return (near(i, b.inHandle, tol) && near(o, b.outHandle, tol))
    || (near(i, b.outHandle, tol) && near(o, b.inHandle, tol));
}

/**
 * The pairing that makes `set` its own mirror image under `m`, or `null` when
 * it is not one: every anchor, handles included, must land on a distinct
 * anchor within `tolerance` on each axis.
 */
export function anchorMirror(set: AnchorSet, m: Affine, tolerance = 1e-6): AnchorMirror | null {
  const n = anchorCount(set);
  const partners: number[] = [];
  const taken = new Set<number>();
  for (let i = 0; i < n; i++) {
    const a = anchorAt(set, i)!;
    let found = -1;
    for (let j = 0; j < n; j++) {
      if (taken.has(j) || !mirrorsOnto(m, a, anchorAt(set, j)!, tolerance)) continue;
      found = j;
      break;
    }
    if (found < 0) return null;
    taken.add(found);
    partners.push(found);
  }
  return { m, partners };
}

function linear(m: Affine, dx: number, dy: number): Pt {
  return { x: m[0] * dx + m[2] * dy, y: m[1] * dx + m[3] * dy };
}

/**
 * Translate the anchors `flats` by `(dx, dy)` the way `translateAnchorBy` does,
 * and each one's partner under every mirror by the mirrored delta. An anchor
 * that is its own partner stays on that mirror's axis. A partner that is
 * itself being dragged moves as dragged.
 */
export function translateAnchorsMirrored(
  set: AnchorSet,
  flats: readonly number[],
  dx: number,
  dy: number,
  mirrors: readonly AnchorMirror[],
): boolean {
  const dragged = new Set(flats);
  const moves = new Map<number, Pt>();
  for (const flat of flats) {
    let d = { x: dx, y: dy };
    for (const { m, partners } of mirrors) {
      if (partners[flat] !== flat) continue;
      const r = linear(m, d.x, d.y);
      d = { x: (d.x + r.x) / 2, y: (d.y + r.y) / 2 };
    }
    moves.set(flat, d);
    for (const { m, partners } of mirrors) {
      const j = partners[flat];
      if (j === undefined || j === flat || dragged.has(j) || moves.has(j)) continue;
      moves.set(j, linear(m, d.x, d.y));
    }
  }
  let changed = false;
  for (const [flat, d] of moves) changed = translateAnchorBy(set, flat, d.x, d.y) || changed;
  return changed;
}

/**
 * Move one handle the way `moveHandleTo` does, and under every mirror the
 * partner's handle that this one's image lands on, to the image of `(toX, toY)`.
 * On an axis anchor that is its own opposite handle.
 */
export function moveHandleMirrored(
  set: AnchorSet,
  flat: number,
  side: 'in' | 'out',
  toX: number,
  toY: number,
  breakSmoothness: boolean,
  mirrors: readonly AnchorMirror[],
): boolean {
  const a = anchorAt(set, flat);
  if (!a) return false;
  const was = side === 'in' ? a.inHandle : a.outHandle;
  const followers: Array<{ j: number; side: 'in' | 'out'; to: Pt }> = [];
  for (const { m, partners } of mirrors) {
    const j = partners[flat];
    const b = j === undefined ? null : anchorAt(set, j);
    if (!b || !was) continue;
    const landed = image(m, was);
    const bSide = dist(landed, b.inHandle) <= dist(landed, b.outHandle) ? 'in' : 'out';
    if (j === flat && bSide === side) continue;
    followers.push({ j, side: bSide, to: image(m, { x: toX, y: toY }) });
  }
  if (!moveHandleTo(set, flat, side, toX, toY, breakSmoothness)) return false;
  for (const f of followers) moveHandleTo(set, f.j, f.side, f.to.x, f.to.y, f.j === flat || breakSmoothness);
  return true;
}

function dist(a: Pt, b: Pt | undefined): number {
  return b ? Math.hypot(a.x - b.x, a.y - b.y) : Infinity;
}

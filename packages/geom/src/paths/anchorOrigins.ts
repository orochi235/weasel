/**
 * Where each point of an edited path came from, so an array kept per point (a skin's
 * weights) can follow an edit that inserts, deletes, or reorders points.
 */

import type { PolygonPath } from '../path';
import { anchorsToPath, pathToAnchors, type PenAnchor } from './anchors';
import type { AnchorSet } from './anchorEdits';
import type { Point } from './cubicMath';
import { worldCoords } from './pathOrigin';

/**
 * Where a point of an edited path came from: point `a` of the path before the edit, or for a
 * point the edit made, a blend `t` of the way from point `a` to point `b`.
 */
export interface PointOrigin {
  a: number;
  b: number;
  t: number;
  /** On an anchor's own point: its subpath now runs the other way through it. */
  reversed?: true;
}

/** The points of the path before the edit that one anchor held. */
interface Held {
  point: number;
  in?: number;
  out?: number;
  /** Where the anchor sat before the edit: its subpath and its index there. */
  sub?: number;
  idx?: number;
}

const at = (x: number): Point => ({ x, y: x });
const keyOf = (p: Point): string => `${p.x},${p.y}`;

/**
 * Which point of `path` each anchor of `set` was decoded from. `pathToAnchors` runs again
 * over a path whose every point holds its own index, so the two walks cannot disagree.
 */
function heldBy(path: PolygonPath, set: AnchorSet): Held[][] {
  const coords = new Float32Array(path.coords.length);
  for (let i = 0; i < coords.length; i++) coords[i] = i >> 1;
  const { origin: _indicesHaveNone, ...bare } = path;
  const indexed = pathToAnchors({ ...bare, coords }).anchors;
  return indexed.map((sub, s) => {
    // No two index points coincide, so a closing curve the real walk folded is unfolded here.
    if (sub.length === set.anchors[s].length + 1) sub[0].inHandle = sub.pop()!.inHandle;
    return sub.map((a, i) => ({ point: a.x, in: a.inHandle?.x, out: a.outHandle?.x, sub: s, idx: i }));
  });
}

/** For each anchor of `path`, by flat index, the index of the point that holds it. */
export function anchorPointIndices(path: PolygonPath): number[] {
  return heldBy(path, pathToAnchors(path)).flat().map((held) => held.point);
}

/** For each point `anchorsToPath` writes for `set`: the flat index of the anchor it belongs to,
 *  times 3, plus 0 for the anchor's own point, 1 for its in handle, and 2 for its out handle. */
function writtenFrom(set: AnchorSet): Float32Array | Float64Array {
  let flat = 0;
  const coded = set.anchors.map((sub) => sub.map((a) => {
    const k = 3 * flat++;
    return {
      ...at(k),
      ...(a.inHandle ? { inHandle: at(k + 1) } : {}),
      ...(a.outHandle ? { outHandle: at(k + 2) } : {}),
    };
  }));
  return worldCoords(anchorsToPath(coded, set.closed));
}

/** The nearest anchor of `sub` from `i`, stepping by `step`, that the path before the edit
 *  held; around the seam when the subpath is closed. */
function neighbor(sub: readonly (Held | undefined)[], closed: boolean, i: number, step: 1 | -1): number {
  for (let n = 1; n < sub.length; n++) {
    let j = i + step * n;
    if (j < 0 || j >= sub.length) {
      if (!closed) return -1;
      j = (j + sub.length) % sub.length;
    }
    if (sub[j]) return j;
  }
  return -1;
}

/** The origin of an anchor the edit made: its held neighbors, blended by its distance to each. */
function blended(
  anchors: readonly PenAnchor[],
  held: readonly (Held | undefined)[],
  closed: boolean,
  i: number,
): PointOrigin | null {
  const p = neighbor(held, closed, i, -1);
  const n = neighbor(held, closed, i, 1);
  if (p === -1 && n === -1) return null;
  const a = held[p === -1 ? n : p]!.point;
  const b = held[n === -1 ? p : n]!.point;
  if (p === -1 || n === -1 || a === b) return { a, b: a, t: 0 };
  const dp = Math.hypot(anchors[i].x - anchors[p].x, anchors[i].y - anchors[p].y);
  const dn = Math.hypot(anchors[i].x - anchors[n].x, anchors[i].y - anchors[n].y);
  return { a, b, t: dp + dn > 0 ? dp / (dp + dn) : 0 };
}

/**
 * For each anchor of a subpath after an edit, whether the subpath now runs the other way
 * through it: its neighbors in the new walk follow it in the old one more often backward than
 * forward. An anchor the edit made takes the answer of the nearest kept anchor before it.
 */
function runsBackward(
  sub: readonly (Held | undefined)[],
  closed: boolean,
  before: { lengths: readonly number[]; closed: readonly boolean[] },
): boolean[] {
  const nextWas = (h: Held): number => {
    const n = before.lengths[h.sub!];
    return h.idx! + 1 < n ? h.idx! + 1 : before.closed[h.sub!] ? 0 : -1;
  };
  // +1 when `y`, after `x` in the new walk, came after it in the old one too; -1 when before it.
  const step = (x: Held | undefined, y: Held | undefined): number => {
    if (x?.sub === undefined || y?.sub === undefined || x.sub !== y.sub) return 0;
    return nextWas(x) === y.idx ? 1 : nextWas(y) === x.idx ? -1 : 0;
  };
  const at = (i: number) => (closed ? sub[(i + sub.length) % sub.length] : sub[i]);
  const own = sub.map((h, i) => (h ? step(at(i - 1), h) + step(h, at(i + 1)) < 0 : null));
  return own.map((flag, i) => {
    if (flag !== null) return flag;
    const p = neighbor(sub, closed, i, -1);
    const n = neighbor(sub, closed, i, 1);
    return p !== -1 ? own[p] === true : n !== -1 && own[n] === true;
  });
}

/** What an anchor the edit put exactly where one was holds: that anchor's point, and each
 *  handle that is where one of its handles was. */
function copied(anchor: PenAnchor, byPlace: ReadonlyMap<string, Held>): Held | undefined {
  const was = byPlace.get(keyOf(anchor));
  if (!was) return undefined;
  const handle = (h: Point | undefined) => (h ? byPlace.get(`${keyOf(anchor)}:${keyOf(h)}`)?.point : undefined);
  return { ...was, in: handle(anchor.inHandle), out: handle(anchor.outHandle) };
}

/**
 * `editAnchorSet`, answering also where each point of the new path came from.
 *
 * An anchor the edit kept, moved or not, keeps its points. One the edit put exactly where an
 * anchor was takes that anchor's, each handle by where it is, so a subpath turned around
 * keeps its weights. A handle an edit gave an anchor that had none takes the anchor's point. An anchor the edit made is a blend of the nearest kept anchors either side
 * of it in its subpath, by its distance to each, or a copy of the one it has; its origin is
 * `null` when its subpath has none.
 */
export function editAnchorSetTracked(
  path: PolygonPath,
  edit: (set: AnchorSet) => boolean | void,
): { path: PolygonPath; origins: (PointOrigin | null)[] } | null {
  const set = pathToAnchors(path);
  const byAnchor = new Map<PenAnchor, Held>();
  const byPlace = new Map<string, Held>();
  heldBy(path, set).forEach((sub, s) => sub.forEach((held, i) => {
    const anchor = set.anchors[s][i];
    byAnchor.set(anchor, held);
    if (byPlace.has(keyOf(anchor))) return;
    // Handles are filed under where they are, for an anchor that comes back as a copy.
    if (anchor.inHandle) byPlace.set(`${keyOf(anchor)}:${keyOf(anchor.inHandle)}`, { point: held.in! });
    if (anchor.outHandle) byPlace.set(`${keyOf(anchor)}:${keyOf(anchor.outHandle)}`, { point: held.out! });
    byPlace.set(keyOf(anchor), { point: held.point, sub: held.sub, idx: held.idx });
  }));

  const before = { lengths: set.anchors.map((sub) => sub.length), closed: [...set.closed] };
  if (edit(set) === false) return null;

  const held: (Held | undefined)[] = [];
  const own: (PointOrigin | null)[] = [];
  set.anchors.forEach((sub, s) => {
    const subHeld = sub.map((a) => byAnchor.get(a) ?? copied(a, byPlace));
    const flipped = runsBackward(subHeld, set.closed[s], before);
    sub.forEach((_, i) => {
      const h = subHeld[i];
      held.push(h);
      const origin = h ? { a: h.point, b: h.point, t: 0 } : blended(sub, subHeld, set.closed[s], i);
      own.push(origin && flipped[i] ? { ...origin, reversed: true } : origin);
    });
  });

  const origins = Array.from(writtenFrom(set).filter((_, i) => i % 2 === 0), (code) => {
    const anchor = Math.floor(code / 3);
    const handle = code % 3 === 1 ? held[anchor]?.in : code % 3 === 2 ? held[anchor]?.out : undefined;
    return handle === undefined ? own[anchor] : { a: handle, b: handle, t: 0 };
  });
  return { path: anchorsToPath(set.anchors, set.closed, path), origins };
}

/**
 * An array kept per point of a path, carried through an edit: `origins` is what
 * {@link editAnchorSetTracked} answered. A point with no origin, and an origin past the
 * array's end, read 0.
 */
export function remapPointValues(
  values: ArrayLike<number>,
  origins: readonly (PointOrigin | null)[],
): number[] {
  return origins.map((o) => {
    if (!o) return 0;
    const a = values[o.a] ?? 0;
    return o.t === 0 ? a : a + ((values[o.b] ?? 0) - a) * o.t;
  });
}

/**
 * Where each point of an edited path came from, so an array kept per point (a skin's
 * weights) can follow an edit that inserts, deletes, or reorders points.
 */

import { PATH_C, PATH_Q, PATH_Z, forEachSegment } from '../commands';
import type { PolygonPath } from '../path';
import { anchorsToPath, pathToAnchors, type PenAnchor } from './anchors';

/** The anchor model `pathToAnchors` produces; `AnchorSet` in `anchorEdits`. */
interface Anchors {
  anchors: PenAnchor[][];
  closed: boolean[];
}

/**
 * Where a point of an edited path came from: point `a` of the path before the edit, or for a
 * point the edit made, a blend `t` of the way from point `a` to point `b`.
 */
export interface PointOrigin {
  a: number;
  b: number;
  t: number;
}

/** The points of the path before the edit that one anchor held. */
interface Held {
  point: number;
  in?: number;
  out?: number;
}

interface Point { x: number; y: number }

const at = (x: number): Point => ({ x, y: x });
const keyOf = (p: Point): string => `${p.x},${p.y}`;

/**
 * Which point of `path` each anchor of `set` was decoded from. `pathToAnchors` runs again
 * over a path whose every point holds its own index, so the two walks cannot disagree.
 */
function heldBy(path: PolygonPath, set: Anchors): Held[][] {
  const coords = new Float32Array(path.coords.length);
  for (let i = 0; i < coords.length; i++) coords[i] = i >> 1;
  const indexed = pathToAnchors({ ...path, coords }).anchors;
  return indexed.map((sub, s) => {
    // No two index points coincide, so a closing curve the real walk folded is unfolded here.
    if (sub.length === set.anchors[s].length + 1) sub[0].inHandle = sub.pop()!.inHandle;
    return sub.map((a) => ({ point: a.x, in: a.inHandle?.x, out: a.outHandle?.x }));
  });
}

/** For each point `anchorsToPath` writes for `set`: the flat index of the anchor it belongs to,
 *  times 3, plus 0 for the anchor's own point, 1 for its in handle, and 2 for its out handle. */
function writtenFrom(set: Anchors): Float32Array {
  let flat = 0;
  const coded = set.anchors.map((sub) => sub.map((a) => {
    const k = 3 * flat++;
    return {
      ...at(k),
      ...(a.inHandle ? { inHandle: at(k + 1) } : {}),
      ...(a.outHandle ? { outHandle: at(k + 2) } : {}),
    };
  }));
  return anchorsToPath(coded, set.closed).coords;
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

/** What an anchor the edit put exactly where one was holds: that anchor's point, and each
 *  handle that is where one of its handles was. */
function copied(anchor: PenAnchor, byPlace: ReadonlyMap<string, Held>): Held | undefined {
  const was = byPlace.get(keyOf(anchor));
  if (!was) return undefined;
  const handle = (h: Point | undefined) => (h ? byPlace.get(`${keyOf(anchor)}:${keyOf(h)}`)?.point : undefined);
  return { point: was.point, in: handle(anchor.inHandle), out: handle(anchor.outHandle) };
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
  edit: (set: Anchors) => boolean | void,
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
    byPlace.set(keyOf(anchor), { point: held.point });
  }));

  if (edit(set) === false) return null;

  const held: (Held | undefined)[] = [];
  const own: (PointOrigin | null)[] = [];
  set.anchors.forEach((sub, s) => {
    const subHeld = sub.map((a) => byAnchor.get(a) ?? copied(a, byPlace));
    sub.forEach((_, i) => {
      const h = subHeld[i];
      held.push(h);
      own.push(h ? { a: h.point, b: h.point, t: 0 } : blended(sub, subHeld, set.closed[s], i));
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

/** For each point of `path`, the index of the anchor it ends, as `countPathAnchors` counts
 *  them (one per M, L, C and Q), or -1 for a control point. */
function anchorOfPoint(path: PolygonPath): Int32Array {
  const owner = new Int32Array(path.coords.length >> 1).fill(-1);
  let anchor = 0;
  forEachSegment(path.commands, path.coords, (cmd, ci) => {
    if (cmd === PATH_Z) return;
    const n = cmd === PATH_C ? 6 : cmd === PATH_Q ? 4 : 2;
    owner[(ci + n - 2) >> 1] = anchor++;
  });
  return owner;
}

/**
 * An array kept per anchor of a path, `stride` numbers each — four color channels, say —
 * carried through an edit from `before` to `after`, with `origins` as
 * {@link editAnchorSetTracked} answered. An anchor the edit kept keeps its numbers; one it
 * made blends those of the anchors it came between. An anchor with no origin reads 0. Anchors
 * are counted as `countPathAnchors` counts them.
 */
export function remapAnchorValues(
  values: ArrayLike<number>,
  stride: number,
  before: PolygonPath,
  after: PolygonPath,
  origins: readonly (PointOrigin | null)[],
): number[] {
  const wasAnchor = anchorOfPoint(before);
  const isAnchor = anchorOfPoint(after);
  const out: number[] = [];
  isAnchor.forEach((anchor, point) => {
    if (anchor === -1) return;
    const o = origins[point];
    const a = o ? wasAnchor[o.a] ?? -1 : -1;
    const b = o ? wasAnchor[o.b] ?? -1 : -1;
    for (let k = 0; k < stride; k++) {
      const va = a === -1 ? 0 : values[a * stride + k] ?? 0;
      const vb = b === -1 ? va : values[b * stride + k] ?? 0;
      out.push(o && o.t !== 0 ? va + (vb - va) * o.t : va);
    }
  });
  return out;
}

/**
 * The region a path fills, redrawn as its outline alone: contours that
 * overlap or cross are cut where they cross and only the pieces with fill on
 * one side are kept. Curves stay curves.
 */
import { cubicEvalAt } from '../curve';
import { flattenCubic } from '../flatten';
import type { Path, PolygonPath } from '../path';
import { PathBuilder } from './builder';
import { lineSegment, pathToCubicContours, splitSegment, type CubicSegment } from './cubicContours';
import { segmentCrossings } from './segmentCrossings';
import { pathSignedArea } from './winding';

/** Options for {@link mergeRegion}. */
export interface MergeRegionOptions {
  /** How far from an edge a point is taken to tell which side is filled, in
   *  the path's units; a sliver of region thinner than this may be lost.
   *  Default 0.01. */
  tolerance?: number;
}

type Pt = [number, number];

/** A cut on a segment: where, and the point both cut ends move onto. */
interface Cut {
  t: number;
  p: Pt;
}

/**
 * The region `path` fills under `'nonzero'`, as contours that neither cross
 * nor overlap, wound so the fill lies on the same side of each as it does on
 * most of `path`. Stroking it traces only the region's edge. Every subpath
 * counts as closed. Answers `path`'s own contours, unchanged, where nothing
 * needs cutting or dropping.
 */
export function mergeRegion(path: Path, opts: MergeRegionOptions = {}): PolygonPath {
  const tol = opts.tolerance ?? 0.01;
  const contours = pathToCubicContours(path).filter((c) => c.segs.length > 0);
  const snap = tol * 1e-3;
  const all = weld(contours.flatMap((c) => closeContour(c.segs, snap)), snap);
  // A positively wound region fills to the right of travel (`growRegion`).
  const fillLeft = pathSignedArea(path) < 0;
  // A segment another contour already runs along carries no edge of its own; its twin decides that.
  const segs = distinct(all, snap);
  const cuts: Cut[][] = segs.map(() => []);
  for (const x of segmentCrossings(segs)) {
    const p = crossingPoint(segs[x.a]!, x.s, segs[x.b]!, x.t, snap);
    cuts[x.a]!.push({ t: x.s, p });
    cuts[x.b]!.push({ t: x.t, p });
  }
  overlapCuts(segs, cuts, snap);
  const rings = flattenAll(all, tol / 4);
  const pieces: CubicSegment[] = [];
  let changed = segs.length < all.length;
  segs.forEach((seg, i) => {
    const parts = cutSegment(seg, cuts[i]!);
    if (parts.length > 1) changed = true;
    for (const part of parts) {
      const side = filledSide(part, rings, tol);
      if (side === null) changed = true;
      else if (side === fillLeft) pieces.push(part);
      else {
        changed = true;
        pieces.push(reversed(part));
      }
    }
  });
  const b = new PathBuilder();
  if (!changed) {
    for (const c of contours) emit(b, closeContour(c.segs, snap));
    return b.build();
  }
  for (const ring of chain(once(pieces))) emit(b, ring);
  return b.build();
}

/**
 * Cuts where two straight edges run along each other: each is cut where the
 * other's ends fall inside it, at that end's own point, so the shared stretch
 * becomes the same piece on both and {@link once} keeps one of it.
 */
function overlapCuts(segs: readonly CubicSegment[], cuts: Cut[][], snap: number): void {
  for (let i = 0; i < segs.length; i++) {
    const a = segs[i]!;
    if (!a.line) continue;
    for (let j = i + 1; j < segs.length; j++) {
      const b = segs[j]!;
      if (!b.line) continue;
      const onA = endsAlong(a, b, snap);
      if (!onA) continue;
      const onB = endsAlong(b, a, snap)!;
      cuts[i]!.push(...onA);
      cuts[j]!.push(...onB);
    }
  }
}

/** Where `b`'s ends fall inside straight edge `a`, when the two lie on one line within `snap` and overlap. */
function endsAlong(a: CubicSegment, b: CubicSegment, snap: number): Cut[] | null {
  const [ax, ay] = [a.c[0], a.c[1]];
  const dx = a.c[6] - ax,
    dy = a.c[7] - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return null;
  const len = Math.sqrt(len2);
  const ends: Pt[] = [[b.c[0], b.c[1]], [b.c[6], b.c[7]]];
  const t: number[] = [];
  for (const [x, y] of ends) {
    if (Math.abs((x - ax) * dy - (y - ay) * dx) / len > snap) return null;
    t.push(((x - ax) * dx + (y - ay) * dy) / len2);
  }
  if (Math.min(t[0]!, t[1]!) >= 1 || Math.max(t[0]!, t[1]!) <= 0) return null;
  return ends.map((p, k) => ({ t: t[k]!, p }));
}

/** `pieces` with each straight one two contours share kept once, known by its ends whatever its handles, and
 *  every piece that runs back over another dropped along with it: a spike of no width a sliver left. */
function once(pieces: readonly CubicSegment[]): CubicSegment[] {
  const keyOf = (c: readonly number[], line: boolean) => (line
    ? `${c[0]},${c[1]},${c[6]},${c[7]}` : c.join(','));
  const kept = new Map<string, CubicSegment>();
  for (const p of pieces) {
    const k = keyOf(p.c, p.line);
    if (kept.has(k)) continue;
    const back = keyOf(reversed(p).c, p.line);
    if (kept.delete(back)) continue;
    kept.set(k, p);
  }
  return [...kept.values()];
}

/** `segs` less each that runs, either way, where an earlier one does: the same welded ends, and every handle
 *  within `snap` of the earlier one's, or both straight. */
function distinct(segs: readonly CubicSegment[], snap: number): CubicSegment[] {
  const byEnds = new Map<string, CubicSegment[]>();
  const ends = (c: readonly number[], a: number, b: number) => `${c[a]},${c[a + 1]}|${c[b]},${c[b + 1]}`;
  const near = (p: CubicSegment, q: CubicSegment, flip: boolean) => p.line && q.line
    || [2, 3, 4, 5].every((k) => Math.abs(p.c[k]! - q.c[flip ? (k < 4 ? k + 2 : k - 2) : k]!) <= snap);
  return segs.filter((s) => {
    const fwd = ends(s.c, 0, 6);
    const twins = [...(byEnds.get(fwd) ?? []).map((q) => [q, false] as const),
      ...(byEnds.get(ends(s.c, 6, 0)) ?? []).map((q) => [q, true] as const)];
    if (twins.some(([q, flip]) => near(s, q, flip))) return false;
    byEnds.set(fwd, [...(byEnds.get(fwd) ?? []), s]);
    return true;
  });
}

/** `segs` with every straight edge no longer than `snap` dropped, the gap it
 *  leaves closed by moving the next start back, and ending where it starts. */
function closeContour(given: readonly CubicSegment[], snap: number): CubicSegment[] {
  const short = (s: CubicSegment) => s.line && Math.hypot(s.c[6] - s.c[0], s.c[7] - s.c[1]) <= snap;
  const segs = given.filter((s) => !short(s));
  if (segs.length === 0) return [];
  for (let i = 0; i < segs.length; i++) {
    const prev = segs[(i + segs.length - 1) % segs.length]!.c,
      s = segs[i]!;
    if (prev[6] !== s.c[0] || prev[7] !== s.c[1]) {
      if (Math.hypot(prev[6] - s.c[0], prev[7] - s.c[1]) <= snap) segs[i] = moveEnds(s, [prev[6], prev[7]], [s.c[6], s.c[7]]);
      else if (i === 0) segs.push(lineSegment(prev[6], prev[7], s.c[0], s.c[1]));
    }
  }
  return segs;
}

/**
 * `segs` with every end within `snap` of an earlier one moved onto it, and
 * any straight edge that leaves with no length dropped, so contours that
 * nearly share a corner share it exactly.
 */
function weld(segs: readonly CubicSegment[], snap: number): CubicSegment[] {
  if (!(snap > 0)) return [...segs];
  const grid = new Map<string, Pt[]>();
  const cell = (v: number) => Math.floor(v / snap);
  const at = (x: number, y: number): Pt => {
    const cx = cell(x),
      cy = cell(y);
    for (let i = cx - 1; i <= cx + 1; i++) {
      for (let j = cy - 1; j <= cy + 1; j++) {
        for (const p of grid.get(`${i},${j}`) ?? []) if (Math.hypot(p[0] - x, p[1] - y) <= snap) return p;
      }
    }
    const p: Pt = [x, y];
    const k = `${cx},${cy}`;
    grid.set(k, [...(grid.get(k) ?? []), p]);
    return p;
  };
  const out: CubicSegment[] = [];
  for (const s of segs) {
    const a = at(s.c[0], s.c[1]),
      b = at(s.c[6], s.c[7]);
    if (s.line && a === b) continue;
    out.push(a[0] === s.c[0] && a[1] === s.c[1] && b[0] === s.c[6] && b[1] === s.c[7] ? s : moveEnds(s, a, b));
  }
  return out;
}

/** One point for a crossing: an end of either segment when it falls there,
 *  or within `snap` of it, so the cut lands on the corner already joining
 *  it, else the midpoint of the two curves' estimates. */
function crossingPoint(a: CubicSegment, s: number, b: CubicSegment, t: number, snap: number): Pt {
  const end = (seg: CubicSegment, u: number): Pt | null =>
    u <= 1e-7 ? [seg.c[0], seg.c[1]] : u >= 1 - 1e-7 ? [seg.c[6], seg.c[7]] : null;
  const fixed = end(a, s) ?? end(b, t);
  if (fixed) return fixed;
  const p = cubicEvalAt(...a.c, s),
    q = cubicEvalAt(...b.c, t);
  const m: Pt = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  for (const c of [a.c, b.c]) {
    for (const k of [0, 6]) if (Math.hypot(c[k]! - m[0], c[k + 1]! - m[1]) <= snap) return [c[k]!, c[k + 1]!];
  }
  return m;
}

/** `seg` cut at every interior cut, each cut end moved onto its cut's point,
 *  a curve's adjacent handle moved with it. */
function cutSegment(seg: CubicSegment, cuts: Cut[]): CubicSegment[] {
  const inner = cuts.filter((c) => c.t > 1e-7 && c.t < 1 - 1e-7).sort((x, y) => x.t - y.t);
  const out: CubicSegment[] = [];
  let rest = seg,
    from = 0;
  let start: Pt = [seg.c[0], seg.c[1]];
  for (const cut of inner) {
    if (cut.t - from < 1e-9 || (cut.p[0] === start[0] && cut.p[1] === start[1])) continue;
    if (cut.p[0] === seg.c[6] && cut.p[1] === seg.c[7]) continue;
    const [l, r] = splitSegment(rest, (cut.t - from) / (1 - from));
    out.push(moveEnds(l, start, cut.p));
    rest = r;
    from = cut.t;
    start = cut.p;
  }
  out.push(moveEnds(rest, start, [seg.c[6], seg.c[7]]));
  return out;
}

function moveEnds(s: CubicSegment, a: Pt, b: Pt): CubicSegment {
  const c = s.c;
  return {
    c: [a[0], a[1], c[2] + a[0] - c[0], c[3] + a[1] - c[1], c[4] + b[0] - c[6], c[5] + b[1] - c[7], b[0], b[1]],
    line: s.line,
  };
}

function reversed(s: CubicSegment): CubicSegment {
  const c = s.c;
  return { c: [c[6], c[7], c[4], c[5], c[2], c[3], c[0], c[1]], line: s.line };
}

/** Each contour's polyline, for counting winding against. */
function flattenAll(segs: readonly CubicSegment[], tol: number): number[][] {
  const rings: number[][] = [];
  let ring: number[] = [];
  for (const { c, line } of segs) {
    if (ring.length === 0) ring.push(c[0], c[1]);
    else if (ring[ring.length - 2] !== c[0] || ring[ring.length - 1] !== c[1]) {
      rings.push(ring);
      ring = [c[0], c[1]];
    }
    if (line) ring.push(c[6], c[7]);
    else flattenCubic(...c, tol, ring);
  }
  if (ring.length > 0) rings.push(ring);
  return rings;
}

function winding(rings: readonly number[][], x: number, y: number): number {
  let w = 0;
  for (const r of rings) {
    for (let i = 0; i + 3 < r.length; i += 2) {
      const ay = r[i + 1]!,
        by = r[i + 3]!;
      if (ay > y === by > y) continue;
      const ax = r[i]!,
        bx = r[i + 2]!;
      if (x >= ax + ((y - ay) / (by - ay)) * (bx - ax)) continue;
      w += ay <= y ? 1 : -1;
    }
  }
  return w;
}

/** Whether the fill lies left of `seg`'s travel (`true`) or right of it, or
 *  `null` when it lies on both sides or neither. Judged at its middle. */
function filledSide(seg: CubicSegment, rings: readonly number[][], tol: number): boolean | null {
  const c = seg.c;
  const [x, y] = cubicEvalAt(...c, 0.5);
  const dx = c[6] + c[4] - c[2] - c[0],
    dy = c[7] + c[5] - c[3] - c[1];
  const len = Math.hypot(dx, dy);
  if (len < 1e-12) return null;
  const nx = (dy / len) * tol,
    ny = (-dx / len) * tol;
  const left = winding(rings, x + nx, y + ny) !== 0,
    right = winding(rings, x - nx, y - ny) !== 0;
  return left === right ? null : left;
}

/** The pieces joined end to start into closed rings. */
function chain(pieces: readonly CubicSegment[]): CubicSegment[][] {
  const key = (x: number, y: number) => `${x},${y}`;
  const from = new Map<string, number[]>();
  pieces.forEach((p, i) => {
    const k = key(p.c[0], p.c[1]);
    const list = from.get(k);
    if (list) list.push(i);
    else from.set(k, [i]);
  });
  const used = new Uint8Array(pieces.length);
  const rings: CubicSegment[][] = [];
  for (let i = 0; i < pieces.length; i++) {
    if (used[i]) continue;
    const ring: CubicSegment[] = [];
    let at: number | undefined = i;
    while (at !== undefined && !used[at]) {
      used[at] = 1;
      const p: CubicSegment = pieces[at]!;
      ring.push(p);
      at = from.get(key(p.c[6], p.c[7]))?.find((j) => !used[j]);
    }
    rings.push(ring);
  }
  return rings;
}

function emit(b: PathBuilder, ring: readonly CubicSegment[]): void {
  if (ring.length === 0) return;
  const [x0, y0] = ring[0]!.c;
  b.moveTo(x0, y0);
  for (const [i, { c, line }] of ring.entries()) {
    if (line && i === ring.length - 1 && c[6] === x0 && c[7] === y0) break;
    if (line) b.lineTo(c[6], c[7]);
    else b.curveTo(c[2], c[3], c[4], c[5], c[6], c[7]);
  }
  b.close();
}

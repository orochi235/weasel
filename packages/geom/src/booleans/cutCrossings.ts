/** Where a cut crosses the contours of a path. */

import type { Point } from '../paths/cubicMath';
import { type Contour, type Station, evalSeg, sideCoeffs, signChanges, endSide } from './contourSegments';

export interface Crossing extends Station {
  contour: number;
  /** Position along the cut: cut segment k runs from k to k + 1. */
  s: number;
  /** True where the cut, going forward, enters the filled region. */
  enters: boolean;
}

/** A point where a path crosses the cut, with the cut's sides before and after it (+1 left, -1 right). */
export interface CutStation extends Station {
  s: number;
  before: number;
  after: number;
}

/**
 * Where along cut segment `k` of `cut` a point on its line falls, as a
 * position on the whole cut, or null when it is off that segment. A point at a
 * joint belongs to the segment that starts there, so it is counted once; a
 * closed cut's last point is its first, a joint like the others.
 */
export function cutPosition(cut: Point[], k: number, pt: Point): number | null {
  const s = along(cut, k, pt);
  const eps = 1e-9;
  const open = isOpen(cut);
  if (s < (k === 0 && open ? 0 : -eps)) return null;
  if (k + 2 === cut.length && open ? s > 1 : s >= 1 - eps) return null;
  return k + Math.min(1, Math.max(0, s));
}

/** Every point where the boundary crosses the cut, sorted along it. */
export function findCrossings(boundaries: Contour[], cut: Point[]): Crossing[] {
  const out: Crossing[] = [];
  boundaries.forEach((contour, ci) => {
    for (const c of cutStations(contour, true, cut)) {
      // Fill is on the boundary's left: crossing from the cut's left to its right is an entry.
      out.push({ contour: ci, seg: c.seg, t: c.t, pt: c.pt, s: c.s, enters: c.before > 0 && c.after < 0 });
    }
  });
  return out.sort((x, y) => x.s - y.s);
}

interface JointCandidate extends CutStation {
  joint: number;
  line: number;
}

/**
 * Every point where `contour` passes from one side of the cut to the other,
 * unordered. A touch is not a crossing, and where the contour runs along the
 * cut the crossing is taken at the end of the run.
 */
export function cutStations(contour: Contour, closed: boolean, cut: Point[]): CutStation[] {
  const out: CutStation[] = [];
  const atJoints: JointCandidate[] = [];
  const n = contour.length;
  for (let k = 0; k + 1 < cut.length; k++) {
    const a = cut[k];
    const d = { x: cut[k + 1].x - a.x, y: cut[k + 1].y - a.y };
    const push = (seg: number, t: number, before: number, after: number) => {
      const pt = evalSeg(contour[seg], t);
      const joint = cutJoint(cut, k, pt);
      if (joint !== null) {
        atJoints.push({ seg, t, pt, s: joint, before, after, joint, line: k });
      } else if (before !== after) {
        const s = cutPosition(cut, k, pt);
        if (s !== null) out.push({ seg, t, pt, s, before, after });
      }
    };
    const fs = contour.map((s) => sideCoeffs(s, a, d));
    fs.forEach((f, si) => {
      for (const c of signChanges(f, false)) push(si, c.t, c.before, c.after);
      if (f[0] !== 0) return;
      const after = endSide(f, true);
      if (after === 0) return;
      let before = 0;
      for (let j = 1; j <= (closed ? n : si) && before === 0; j++) before = endSide(fs[(si - j + n) % n], false);
      if (before !== 0) push(si, 0, before, after);
    });
  }
  return out.concat(jointCrossings(contour, closed, cut, atJoints));
}

/**
 * Which of the detections at the cut's joints are crossings of the cut itself.
 * A detection is made against one segment's line, so it can be a touch of the
 * cut that crosses that line, or a crossing that only touches it.
 */
function jointCrossings(contour: Contour, closed: boolean, cut: Point[], cands: JointCandidate[]): CutStation[] {
  const out: CutStation[] = [];
  const used = new Set<JointCandidate>();
  for (const c of cands) {
    if (used.has(c)) continue;
    const tol = 1e-9 * (segLength(cut, c.joint) + segLength(cut, prevSeg(cut, c.joint)));
    const group = cands.filter((o) => !used.has(o) && o.joint === c.joint &&
      Math.abs(o.pt.x - c.pt.x) <= tol && Math.abs(o.pt.y - c.pt.y) <= tol);
    for (const o of group) used.add(o);
    const rep = group.find((o) => o.line === c.joint) ?? c;

    const ahead = probe(contour, closed, rep.seg, rep.t, 1);
    const after = ahead ? jointSide(cut, c.joint, ahead) : rep.after;
    // The contour goes on along the cut: the crossing, if any, is at the end of that run.
    if (after === 0) continue;
    const behind = probe(contour, closed, rep.seg, rep.t, -1);
    let before = behind ? jointSide(cut, c.joint, behind) : rep.before;
    if (before === 0 && behind) {
      // The contour arrives along the cut: its side before the run, as seen by the line it ran along.
      const line = lineSide(cut, prevSeg(cut, c.joint), c.joint, behind) === 0 ? prevSeg(cut, c.joint) : c.joint;
      before = group.find((o) => o.line === line)?.before ?? 0;
    }
    if (before !== 0 && before !== after) out.push({ seg: rep.seg, t: rep.t, pt: rep.pt, s: rep.s, before, after });
  }
  return out;
}

/**
 * The joint of `cut` that a point on cut segment `k`'s line sits at, or null.
 * Joints are numbered by the segment that starts there; a closed cut's start
 * is a joint, an open cut's ends are not.
 */
function cutJoint(cut: Point[], k: number, pt: Point): number | null {
  const s = along(cut, k, pt);
  const eps = 1e-9;
  const open = isOpen(cut);
  if (Math.abs(s) <= eps && (k > 0 || !open)) return k;
  if (Math.abs(s - 1) <= eps && (k + 2 < cut.length || !open)) return (k + 1) % (cut.length - 1);
  return null;
}

/** The side of the cut, near joint `j`, that `q` is on: +1 left, -1 right, 0 on it. */
function jointSide(cut: Point[], j: number, q: Point): number {
  const p = prevSeg(cut, j);
  const sIn = lineSide(cut, p, j, q), sOut = lineSide(cut, j, j, q);
  const a = cut[p], b = cut[j], c = cut[j + 1];
  const turn = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
  if (turn > 0) return sIn > 0 && sOut > 0 ? 1 : sIn < 0 || sOut < 0 ? -1 : 0;
  if (turn < 0) return sIn < 0 && sOut < 0 ? -1 : sIn > 0 || sOut > 0 ? 1 : 0;
  return sOut;
}

/** The side of cut segment `k`'s line that `q` is on, seen from joint `j`, with a relative tolerance. */
function lineSide(cut: Point[], k: number, j: number, q: Point): number {
  const a = cut[k], b = cut[k + 1], o = cut[j];
  const dx = b.x - a.x, dy = b.y - a.y, qx = q.x - o.x, qy = q.y - o.y;
  const c = dx * qy - dy * qx;
  const r = 1e-9 * Math.hypot(dx, dy) * Math.hypot(qx, qy);
  return c > r ? 1 : c < -r ? -1 : 0;
}

/** A point just before (`dir` -1) or after (+1) the station on `contour`, or null past an open end. */
function probe(contour: Contour, closed: boolean, seg: number, t: number, dir: 1 | -1): Point | null {
  const n = contour.length;
  let tt = t + dir * 1e-4, si = seg;
  if (tt < 0) {
    if (!closed && si === 0) return null;
    si = (si - 1 + n) % n; tt += 1;
  } else if (tt > 1) {
    if (!closed && si === n - 1) return null;
    si = (si + 1) % n; tt -= 1;
  }
  return evalSeg(contour[si], tt);
}

function along(cut: Point[], k: number, pt: Point): number {
  const a = cut[k], b = cut[k + 1];
  const dx = b.x - a.x, dy = b.y - a.y;
  return ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / (dx * dx + dy * dy);
}

const isOpen = (cut: Point[]): boolean => {
  const end = cut[cut.length - 1];
  return end.x !== cut[0].x || end.y !== cut[0].y;
};

const prevSeg = (cut: Point[], j: number): number => (j === 0 ? cut.length - 2 : j - 1);

const segLength = (cut: Point[], k: number): number => Math.hypot(cut[k + 1].x - cut[k].x, cut[k + 1].y - cut[k].y);

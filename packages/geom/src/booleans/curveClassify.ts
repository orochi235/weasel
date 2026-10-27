/** Which edges of a cut arrangement bound a boolean's result, by the winding on either side. */

import type { PathFillRule } from '../path';
import type { Point } from '../paths/cubicMath';
import { type Seg, type Contour, evalSeg, derivSeg, sideCoeffs, signChanges } from './contourSegments';
import type { Edge } from './curveEdges';

/** One operand's segments, each with its box, for winding tests. */
export interface WindingSet {
  segs: Seg[];
  boxes: Float64Array;
  fillRule: PathFillRule;
}

export function windingSet(contours: readonly Contour[], fillRule: PathFillRule): WindingSet {
  const segs = contours.flat();
  const boxes = new Float64Array(segs.length * 4);
  segs.forEach((s, i) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of s) {
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x);
      y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
    }
    boxes.set([x0, y0, x1, y1], i * 4);
  });
  return { segs, boxes, fillRule };
}

const RAY: Point = { x: 1, y: 0 };

/** Winding number of `q`, by a ray cast in +x against the exact curves. */
function winding(q: Point, set: WindingSet): number {
  let w = 0;
  const { segs, boxes } = set;
  for (let i = 0; i < segs.length; i++) {
    if (q.y < boxes[i * 4 + 1] || q.y > boxes[i * 4 + 3] || boxes[i * 4 + 2] < q.x) continue;
    const s = segs[i];
    for (const c of signChanges(sideCoeffs(s, q, RAY), true)) {
      if (evalSeg(s, c.t).x > q.x) w += c.after > 0 ? 1 : -1;
    }
  }
  return w;
}

const filled = (w: number, rule: PathFillRule): boolean => (rule === 'evenodd' ? (w & 1) !== 0 : w !== 0);

const reversed = (e: Edge): Edge => ({ ...e, seg: e.seg.slice().reverse(), from: e.to, to: e.from, reversed: true });

/**
 * The edges where `keep` changes across them, each turned so the kept side
 * is on its left. `keep` is given whether each operand covers a point.
 * Null when an edge lies along another operand's outline, or along a second
 * stretch of its own, which the winding on its two sides gives away.
 */
export function classifyEdges(
  edges: readonly Edge[],
  sets: readonly WindingSet[],
  keep: (inside: boolean[]) => boolean,
  probe: number,
): Edge[] | null {
  const out: Edge[] = [];
  const inL: boolean[] = new Array<boolean>(sets.length);
  const inR: boolean[] = new Array<boolean>(sets.length);
  for (const e of edges) {
    // Probe the source curve rather than the cut piece, whose ends were snapped.
    const tm = (e.t0 + e.t1) / 2;
    const m = evalSeg(e.source, tm);
    let tan = derivSeg(e.source, tm);
    let len = Math.hypot(tan.x, tan.y);
    if (len === 0) {
      const a = e.seg[0], b = e.seg[e.seg.length - 1];
      tan = { x: b.x - a.x, y: b.y - a.y };
      len = Math.hypot(tan.x, tan.y);
      if (len === 0) continue;
    }
    const nx = -tan.y / len * probe, ny = tan.x / len * probe;
    const L = { x: m.x + nx, y: m.y + ny }, R = { x: m.x - nx, y: m.y - ny };
    for (let k = 0; k < sets.length; k++) {
      const wl = winding(L, sets[k]), wr = winding(R, sets[k]);
      if (k === e.operand ? Math.abs(wl - wr) !== 1 : wl !== wr) return null;
      inL[k] = filled(wl, sets[k].fillRule);
      inR[k] = filled(wr, sets[k].fillRule);
    }
    const l = keep(inL), r = keep(inR);
    if (l !== r) out.push(l ? e : reversed(e));
  }
  return out;
}

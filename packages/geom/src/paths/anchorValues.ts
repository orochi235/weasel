/**
 * Arrays kept per anchor of a path — vertex colors, stroke widths — carried through an edit
 * that `editAnchorSetTracked` reported.
 */

import { PATH_C, PATH_Q, PATH_Z, forEachSegment } from '../commands';
import type { PolygonPath } from '../path';
import type { PointOrigin } from './anchorOrigins';

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
 * Where each anchor of `after` came from, in anchors of `before` as `countPathAnchors` counts
 * them, given the point `origins` `editAnchorSetTracked` answered for the edit: anchor `a`, or
 * for an anchor the edit made, a blend `t` of the way from `a` to `b`. `reversed` marks an
 * anchor whose subpath now runs the other way through it. Null for an anchor with no origin.
 */
export function anchorOriginsOf(
  before: PolygonPath,
  after: PolygonPath,
  origins: readonly (PointOrigin | null)[],
): (PointOrigin | null)[] {
  const wasAnchor = anchorOfPoint(before);
  const out: (PointOrigin | null)[] = [];
  anchorOfPoint(after).forEach((anchor, point) => {
    if (anchor === -1) return;
    const o = origins[point];
    const a = o ? wasAnchor[o.a] ?? -1 : -1;
    if (!o || a === -1) {
      out.push(null);
      return;
    }
    const b = wasAnchor[o.b] ?? -1;
    out.push({ a, b: b === -1 ? a : b, t: b === -1 ? 0 : o.t, ...(o.reversed ? { reversed: true as const } : {}) });
  });
  return out;
}

/**
 * An array kept per anchor of a path, `stride` numbers each — four color channels, say —
 * carried through an edit from `before` to `after`, with `origins` as
 * `editAnchorSetTracked` answered. An anchor the edit kept keeps its numbers; one it
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
  const out: number[] = [];
  for (const o of anchorOriginsOf(before, after, origins)) {
    for (let k = 0; k < stride; k++) {
      const va = o ? values[o.a * stride + k] ?? 0 : 0;
      const vb = o ? values[o.b * stride + k] ?? 0 : 0;
      out.push(o && o.t !== 0 ? va + (vb - va) * o.t : va);
    }
  }
  return out;
}

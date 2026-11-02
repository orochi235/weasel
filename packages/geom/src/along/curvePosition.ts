import { segmentLength, segmentTAtLength } from '../paths/segmentLength';
import { segmentCoords } from './bezier';
import { tableInternals, type LengthSpan, type LengthTable } from './lengthTable';

/**
 * A place on a path that no flattening moves: curve parameter `t` of segment
 * `segment` of run `run`, segments counted from each run's first point, a
 * closed run's closing edge last. Every flattening of the path cuts at the same
 * point for it, whatever its tolerance.
 */
export interface CurvePosition {
  run: number;
  segment: number;
  t: number;
}

/** A stretch of a path between two curve positions, `from` before `to` in pen order. */
export interface CurveSpan {
  from: CurvePosition;
  to: CurvePosition;
}

/** How many segments run `r` of `t` has: its closing edge included when closed. */
export function runSegments(t: LengthTable, r: number): number {
  return tableInternals(t).cum[r].length - 1;
}

/**
 * `span`, pen-order lengths along `t`, as curve positions: where a length falls
 * on a run boundary, `from` starts the later run and `to` ends the earlier one,
 * so neither carries a run of no length. Null when the span is empty.
 */
export function curveSpan(t: LengthTable, span: LengthSpan): CurveSpan | null {
  const from = Math.max(span.from, 0);
  const to = Math.min(span.to, t.total);
  if (!(from < to)) return null;
  const a = curveAtLength(t, from, true);
  const b = curveAtLength(t, to, false);
  return a && b ? { from: a, to: b } : null;
}

/** The pen-order length at curve position `at`: the inverse of {@link curveSpan}. */
export function lengthAtCurve(t: LengthTable, at: CurvePosition): number {
  const { cum } = tableInternals(t);
  const r = Math.min(Math.max(at.run, 0), t.runs.length - 1);
  if (r < 0) return 0;
  const c = cum[r];
  const segs = c.length - 1;
  if (segs <= 0) return c[0];
  const k = Math.min(Math.max(Math.floor(at.segment), 0), segs - 1);
  const f = Math.min(Math.max(at.t, 0), 1);
  const len = c[k + 1] - c[k];
  const ctl = t.runs[r].controls?.[k];
  if (!ctl || ctl.length === 0 || f <= 0 || f >= 1 || !(len > 0)) return c[k] + f * len;
  return c[k] + segmentLength(segmentCoords(t.runs[r].points, ctl, t.dim, k), t.dim, 0, f);
}

/** The curve position at pen length `s`; `starts` picks the segment leaving a shared point rather than the one arriving. */
function curveAtLength(t: LengthTable, s: number, starts: boolean): CurvePosition | null {
  const { cum } = tableInternals(t);
  for (let r = 0; r < cum.length; r++) {
    const c = cum[r];
    const end = c[c.length - 1];
    if (c.length < 2 || !(end > c[0]) || (starts ? s >= end : s > end)) continue;
    for (let k = 0; k < c.length - 1; k++) {
      const len = c[k + 1] - c[k];
      if (!(len > 0) || (starts ? s >= c[k + 1] : s > c[k + 1])) continue;
      return { run: r, segment: k, t: paramAt(t, r, k, s - c[k], len) };
    }
  }
  return null;
}

function paramAt(t: LengthTable, r: number, k: number, local: number, len: number): number {
  const ctl = t.runs[r].controls?.[k];
  if (!ctl || ctl.length === 0) return Math.min(Math.max(local / len, 0), 1);
  return segmentTAtLength(segmentCoords(t.runs[r].points, ctl, t.dim, k), t.dim, local, len);
}

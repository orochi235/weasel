import { tableInternals, type LengthTable } from './lengthTable';

type Comps = [number, number, number];

/**
 * The point at pen-order length `s`, and the unit tangent of the segment
 * arriving there (leaving, at a run's start). Components past the table's
 * `dim` read 0. Clamps to the path; where two runs meet, answers the end of the
 * earlier one. A path with no length answers a zero tangent.
 */
export function pointAtLength(t: LengthTable, s: number): { point: Comps; tangent: Comps } {
  const { cum } = tableInternals(t);
  const len = Number.isNaN(s) ? 0 : Math.min(Math.max(s, 0), t.total);
  let r = cum.findIndex((c, i) => c.length >= 2 && len <= t.runStart[i + 1]);
  if (r < 0) {
    r = t.runs.length - 1;
    while (r >= 0 && t.runs[r].points.length < t.dim) r--;
    if (r < 0) return { point: [0, 0, 0], tangent: [0, 0, 0] };
    return { point: at(t, r, 0), tangent: [0, 0, 0] };
  }
  const c = cum[r];
  let i = 0;
  while (i < c.length - 2 && c[i + 1] < len) i++;
  const span = c[i + 1] - c[i];
  const f = span > 0 ? (len - c[i]) / span : 0;
  const a = at(t, r, i);
  const b = at(t, r, i + 1);
  return { point: [lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f)], tangent: tangentNear(t, r, i) };
}

/** Point `i` of run `r`, wrapping a closed run's closing edge back to its first. */
function at(t: LengthTable, r: number, i: number): Comps {
  const { points } = t.runs[r];
  const n = Math.floor(points.length / t.dim);
  const o = (i % n) * t.dim;
  return [points[o], points[o + 1], t.dim === 3 ? points[o + 2] : 0];
}

/** The direction of segment `i`, or of the nearest one with length, looking back first. */
function tangentNear(t: LengthTable, r: number, i: number): Comps {
  const last = tableInternals(t).cum[r].length - 2;
  for (let k = i; k >= 0; k--) { const d = direction(t, r, k); if (d) return d; }
  for (let k = i + 1; k <= last; k++) { const d = direction(t, r, k); if (d) return d; }
  return [0, 0, 0];
}

function direction(t: LengthTable, r: number, i: number): Comps | null {
  const a = at(t, r, i);
  const b = at(t, r, i + 1);
  const d: Comps = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const l = Math.hypot(d[0], d[1], d[2]);
  return l > 0 ? [d[0] / l, d[1] / l, d[2] / l] : null;
}

const lerp = (a: number, b: number, f: number): number => a + (b - a) * f;

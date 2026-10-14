/**
 * Points along a stroke by the measure a width profile uses: the fraction of
 * each subpath's arc length.
 */
import type { Path } from '@weasel-js/geom';
import { extractPolylines, type Polyline } from '@weasel-js/geom/tessellate';

/** A point on a stroke's centerline. */
export interface StrokeSite {
  /** Which subpath, in path order. */
  subpath: number;
  /** How far along that subpath, as a fraction of its arc length. */
  t: number;
  /** That subpath's arc length. */
  length: number;
  x: number;
  y: number;
  /** The centerline's unit normal there, 90° counterclockwise of its heading. */
  nx: number;
  ny: number;
}

/** Options for {@link nearestStrokeSite} and {@link strokeSitesAt}. */
export interface StrokeSiteOptions {
  /** Flatness tolerance for curves, in the path's units. */
  flattenTolerance?: number;
}

interface Run {
  pts: number[];
  /** Arc length to each point; one more entry than points on a closed run. */
  cum: number[];
  closed: boolean;
}

function runsOf(path: Path, opts: StrokeSiteOptions): Run[] {
  return extractPolylines(path, { flattenTolerance: opts.flattenTolerance }).map((pl: Polyline) => {
    const pts = pl.closed ? [...pl.points, pl.points[0], pl.points[1]] : pl.points;
    const cum = [0];
    for (let i = 2; i < pts.length; i += 2) {
      cum.push(cum[cum.length - 1] + Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]));
    }
    return { pts, cum, closed: pl.closed };
  });
}

function siteOn(run: Run, subpath: number, seg: number, f: number): StrokeSite {
  const { pts, cum } = run;
  const ax = pts[seg * 2], ay = pts[seg * 2 + 1];
  const dx = pts[seg * 2 + 2] - ax, dy = pts[seg * 2 + 3] - ay;
  const len = Math.hypot(dx, dy) || 1;
  const total = cum[cum.length - 1];
  return {
    subpath,
    t: total > 0 ? (cum[seg] + (cum[seg + 1] - cum[seg]) * f) / total : 0,
    length: total,
    x: ax + dx * f,
    y: ay + dy * f,
    nx: -dy / len,
    ny: dx / len,
  };
}

/** The point of `path`'s centerline nearest `(x, y)`, with how far away it
 *  is, or `null` for a path with no length. */
export function nearestStrokeSite(
  path: Path, x: number, y: number, opts: StrokeSiteOptions = {},
): (StrokeSite & { distance: number }) | null {
  let best: (StrokeSite & { distance: number }) | null = null;
  runsOf(path, opts).forEach((run, subpath) => {
    const { pts } = run;
    for (let seg = 0; seg + 1 < pts.length / 2; seg++) {
      const ax = pts[seg * 2], ay = pts[seg * 2 + 1];
      const dx = pts[seg * 2 + 2] - ax, dy = pts[seg * 2 + 3] - ay;
      const len2 = dx * dx + dy * dy;
      if (len2 === 0) continue;
      const f = Math.min(1, Math.max(0, ((x - ax) * dx + (y - ay) * dy) / len2));
      const distance = Math.hypot(ax + dx * f - x, ay + dy * f - y);
      if (best === null || distance < best.distance) best = { ...siteOn(run, subpath, seg, f), distance };
    }
  });
  return best;
}

/** The point a fraction `t` along each of `path`'s subpaths. */
export function strokeSitesAt(path: Path, t: number, opts: StrokeSiteOptions = {}): StrokeSite[] {
  const out: StrokeSite[] = [];
  runsOf(path, opts).forEach((run, subpath) => {
    const { cum } = run;
    const total = cum[cum.length - 1];
    if (!(total > 0)) return;
    const at = Math.min(1, Math.max(0, t)) * total;
    let seg = 0;
    while (seg < cum.length - 2 && (cum[seg + 1] < at || cum[seg + 1] === cum[seg])) seg++;
    const span = cum[seg + 1] - cum[seg];
    out.push(siteOn(run, subpath, seg, span > 0 ? (at - cum[seg]) / span : 0));
  });
  return out;
}

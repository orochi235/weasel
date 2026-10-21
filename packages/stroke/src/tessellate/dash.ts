import type { Path } from '@weasel-js/geom';
import { anchorParamsBetween, extractPolylines, type Polyline } from '@weasel-js/geom/tessellate';
import { dashPattern } from '@weasel-js/paint';

/** One "on" run being collected: points with their anchor params and, when
 *  the source carries them, widths. */
interface Run {
  pts: number[];
  a: number[];
  b: number[];
  t: number[];
  w: number[] | null;
  o: number[] | null;
}

/** One point of the source walk, or a point between two of them. */
interface At {
  x: number; y: number;
  a: number; b: number; t: number;
  w: number;
  o: number;
}

function runFrom(p: At, widths: boolean, offsets: boolean): Run {
  return { pts: [p.x, p.y], a: [p.a], b: [p.b], t: [p.t], w: widths ? [p.w] : null, o: offsets ? [p.o] : null };
}

function extend(run: Run, p: At): void {
  run.pts.push(p.x, p.y); run.a.push(p.a); run.b.push(p.b); run.t.push(p.t);
  run.w?.push(p.w);
  run.o?.push(p.o);
}

function toPolyline(run: Run, closed = false): Polyline {
  const pl: Polyline = {
    points: run.pts,
    closed,
    anchorA: new Uint32Array(run.a),
    anchorB: new Uint32Array(run.b),
    anchorT: new Float32Array(run.t),
  };
  if (run.w) pl.widths = new Float32Array(run.w);
  if (run.o) pl.offsets = new Float32Array(run.o);
  return pl;
}

/**
 * The dashed runs of every polyline of one path. Whether the pattern is too
 * fine to dash is decided once for the whole path, as a PDF reader's own
 * stroke operator would, so no subpath goes solid while its neighbor dashes.
 */
export function dashPolylines(polylines: readonly Polyline[], pattern: readonly number[] | undefined): Polyline[] {
  const dash = dashPattern(pattern, totalLength(polylines));
  if (dash === 'solid') return [...polylines];
  if (dash === 'non-finite') return [];
  return polylines.flatMap((pl) => splitForDash(pl, dash));
}

/**
 * The length a dash pattern runs along `path`, every subpath included: what a
 * writer handing the dash to another stroker passes to `dashPattern`.
 */
export function dashLength(path: Path): number {
  return totalLength(extractPolylines(path));
}

function totalLength(polylines: readonly Polyline[]): number {
  return polylines.reduce((sum, pl) => sum + polylineLength(pl), 0);
}

/** The length `splitForDash` walks, the closing segment included. */
function polylineLength(pl: Polyline): number {
  const p = pl.points;
  const n = p.length / 2;
  let len = 0;
  for (let i = 1; i < n; i++) len += Math.hypot(p[i * 2] - p[i * 2 - 2], p[i * 2 + 1] - p[i * 2 - 1]);
  if (pl.closed && n > 1) len += Math.hypot(p[0] - p[n * 2 - 2], p[1] - p[n * 2 - 1]);
  return len;
}

/**
 * Split a polyline into open sub-polylines for the "on" portions of a dash
 * pattern. Each output sub-polyline gets caps from the stroke's `cap` setting.
 * The "off" portions become invisible gaps. Anchor params and per-point
 * widths and offsets are carried through: a dash boundary landing mid-segment takes
 * {@link anchorParamsBetween}'s params and the width interpolated there.
 * A dash {@link dashPattern} reads as solid along `pl` returns `pl` whole,
 * and a non-finite one returns nothing.
 */
export function splitForDash(pl: Polyline, pattern: readonly number[]): Polyline[] {
  const dash = dashPattern(pattern, polylineLength(pl));
  if (dash === 'solid') return [pl];
  if (dash === 'non-finite') return [];
  const out: Polyline[] = [];
  const ptCount = pl.points.length / 2;
  const plA = pl.anchorA ?? new Uint32Array(ptCount);
  const plB = pl.anchorB ?? new Uint32Array(ptCount);
  const plT = pl.anchorT ?? new Float32Array(ptCount);
  const W = pl.widths;
  const O = pl.offsets;
  const pointAt = (i: number): At => ({
    x: pl.points[i * 2], y: pl.points[i * 2 + 1], a: plA[i], b: plB[i], t: plT[i], w: W ? W[i] : 0, o: O ? O[i] : 0,
  });

  let dashIdx = 0;
  let dashRemaining = dash[0];
  let onPhase = true;
  let cur: Run | null = runFrom(pointAt(0), !!W, !!O);

  const flushAndAdvance = (at: At) => {
    if (cur && cur.pts.length >= 4) out.push(toPolyline(cur));
    dashIdx = (dashIdx + 1) % dash.length;
    dashRemaining = dash[dashIdx];
    onPhase = !onPhase;
    cur = onPhase ? runFrom(at, !!W, !!O) : null;
  };

  let prevX = pl.points[0], prevY = pl.points[1];
  const segCount = pl.closed ? ptCount : ptCount - 1;

  for (let i = 0; i < segCount; i++) {
    const start = pointAt(i);
    const end = pointAt((i + 1) % ptCount);
    const segFullLen = Math.hypot(end.x - prevX, end.y - prevY);
    // A coincident point still carries its width, as a nib's corner does.
    if (segFullLen <= 1e-9) {
      if (onPhase && cur) extend(cur, end);
      continue;
    }
    let segLen = segFullLen;
    let traveled = 0;

    while (segLen > 1e-9) {
      if (segLen <= dashRemaining) {
        if (onPhase && cur) extend(cur, end);
        dashRemaining -= segLen;
        prevX = end.x; prevY = end.y;
        segLen = 0;
        if (dashRemaining <= 1e-9) flushAndAdvance(end);
      } else {
        traveled += dashRemaining;
        const frac = traveled / segFullLen;
        const [a, b, t] = anchorParamsBetween(start.a, start.b, start.t, end.a, end.b, end.t, frac);
        const mid: At = {
          x: start.x + (end.x - start.x) * frac, y: start.y + (end.y - start.y) * frac,
          a, b, t, w: start.w + (end.w - start.w) * frac, o: start.o + (end.o - start.o) * frac,
        };
        if (onPhase && cur) extend(cur, mid);
        prevX = mid.x; prevY = mid.y;
        segLen = Math.hypot(end.x - prevX, end.y - prevY);
        flushAndAdvance(mid);
      }
    }
  }

  const tail: Run | null = cur;
  if (tail && tail.pts.length >= 4) closeOut(pl, tail, out);
  return out;
}

/**
 * Push the run still open at the end of the walk. A closed subpath's walk ends
 * at the vertex it started from, so the run still open there and the run that
 * started there are one dash. Pushed separately they are two butt-capped
 * ribbons meeting at the seam — the visible artifact whenever the pattern
 * doesn't divide the perimeter.
 */
function closeOut(pl: Polyline, tail: Run, out: Polyline[]): void {
  const tx = tail.pts[tail.pts.length - 2], ty = tail.pts[tail.pts.length - 1];
  const meets = (x: number, y: number) => Math.hypot(tx - x, ty - y) <= 1e-9;
  if (pl.closed && out.length > 0 && meets(out[0].points[0], out[0].points[1])) {
    out[0] = joinAtSeam(toPolyline(tail), out[0]);
  } else if (pl.closed && out.length === 0 && meets(tail.pts[0], tail.pts[1])) {
    // Every gap fell outside the perimeter: the dash is the whole loop, and
    // a loop stroked as an open run seams at its own start vertex too.
    out.push(toPolyline({
      pts: tail.pts.slice(0, -2), a: tail.a.slice(0, -1), b: tail.b.slice(0, -1), t: tail.t.slice(0, -1),
      w: tail.w ? tail.w.slice(0, -1) : null, o: tail.o ? tail.o.slice(0, -1) : null,
    }, true));
  } else {
    out.push(toPolyline(tail));
  }
}

/** `tail` continued by `head`, which starts where `tail` ends — the shared
 *  vertex is carried once. */
function joinAtSeam(tail: Polyline, head: Polyline): Polyline {
  const pl: Polyline = {
    points: [...tail.points, ...head.points.slice(2)],
    closed: false,
    anchorA: Uint32Array.from([...tail.anchorA!, ...head.anchorA!.subarray(1)]),
    anchorB: Uint32Array.from([...tail.anchorB!, ...head.anchorB!.subarray(1)]),
    anchorT: Float32Array.from([...tail.anchorT!, ...head.anchorT!.subarray(1)]),
  };
  if (tail.widths && head.widths) pl.widths = Float32Array.from([...tail.widths, ...head.widths.subarray(1)]);
  if (tail.offsets && head.offsets) pl.offsets = Float32Array.from([...tail.offsets, ...head.offsets.subarray(1)]);
  return pl;
}

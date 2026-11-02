/**
 * Soft selection over an anchor set: how strongly an edit to some anchors
 * carries to the anchors near them, by distance measured along the path.
 *
 * Distance is arc length along the drawn curve, not a straight line, so two
 * anchors that sit close across a gap in a shape are as far apart as the
 * path between them. A `scale` measures it in screen pixels under a view's
 * zoom, per axis.
 */
import type { AnchorSet } from './anchorEdits';
import type { PenAnchor } from './anchors';
import { cubicPointAt, type Point } from './cubicMath';
import { lerpPoint } from '../points2';

/** How influence fades from 1 at a selected anchor to 0 at the radius:
 *  `smooth` eases out and in, `linear` falls evenly, `sharp` drops fast and
 *  tails off. */
export type SoftFalloff = 'smooth' | 'linear' | 'sharp';

/**
 * The weight `falloff` gives a point `distance` from the selection, for a
 * radius of `radius`: 1 at distance 0, 0 at the radius and beyond.
 */
export function softFalloff(falloff: SoftFalloff, distance: number, radius: number): number {
  if (!(radius > 0) || distance >= radius) return 0;
  if (distance <= 0) return 1;
  const u = distance / radius;
  switch (falloff) {
    case 'linear': return 1 - u;
    case 'sharp': return (1 - u) * (1 - u);
    case 'smooth': return 0.5 + 0.5 * Math.cos(Math.PI * u);
  }
}

/** Arc length along one segment, sampled at evenly spaced curve parameters. */
export interface SegmentMeasure {
  /** Arc length from the subpath's start to each sample; sample `i` is at
   *  parameter `i / (lengths.length - 1)`. */
  lengths: Float64Array;
}

/** Arc lengths along one subpath, as {@link measureAnchorPath} takes them. */
export interface AnchorSubpathMeasure {
  closed: boolean;
  /** Flat index of the subpath's first anchor. */
  first: number;
  /** Arc length from the subpath's start to each anchor. */
  at: Float64Array;
  /** Total length, the closing segment included on a closed subpath. */
  length: number;
  /** Segment `i` runs from anchor `i` to anchor `i + 1`, wrapping on a closed subpath. */
  segments: SegmentMeasure[];
}

/** Arc lengths along every subpath of an anchor set, as
 *  {@link measureAnchorPath} takes them. Read it with
 *  {@link softSelectionWeights} and {@link softSelectionBand}. */
export interface AnchorPathMeasure {
  readonly subpaths: readonly AnchorSubpathMeasure[];
}

/** Options for {@link measureAnchorPath}. */
export interface MeasureAnchorPathOptions {
  /** Per-axis factor applied before measuring — a view's scale, to measure in
   *  screen pixels. Default 1 on both axes. */
  scale?: { x: number; y: number };
  /** Samples taken along each curved segment. Default 24. */
  samples?: number;
}

/** The control points of segment `i` of `sub`, or null past its last segment. */
function segmentControls(sub: readonly PenAnchor[], closed: boolean, i: number): [Point, Point, Point, Point] | null {
  const n = sub.length;
  if (i >= n - 1 && !(closed && i === n - 1)) return null;
  const a = sub[i]!;
  const b = sub[(i + 1) % n]!;
  return [a, a.outHandle ?? a, b.inHandle ?? b, b];
}

function isStraight(c: readonly Point[]): boolean {
  return c[1] === c[0] && c[2] === c[3];
}

/** Measure the arc length along every subpath of `set`. */
export function measureAnchorPath(set: AnchorSet, opts: MeasureAnchorPathOptions = {}): AnchorPathMeasure {
  const sx = opts.scale?.x ?? 1;
  const sy = opts.scale?.y ?? 1;
  const samples = Math.max(2, Math.round(opts.samples ?? 24));
  const subpaths: AnchorSubpathMeasure[] = [];
  let first = 0;
  set.anchors.forEach((sub, s) => {
    const closed = set.closed[s] ?? false;
    const at = new Float64Array(sub.length);
    const segments: SegmentMeasure[] = [];
    let run = 0;
    for (let i = 0; ; i++) {
      const c = segmentControls(sub, closed, i);
      if (!c) break;
      at[i] = run;
      const steps = isStraight(c) ? 1 : samples;
      const lengths = new Float64Array(steps + 1);
      lengths[0] = run;
      let prev = c[0];
      for (let k = 1; k <= steps; k++) {
        const p = steps === 1 ? c[3] : cubicPointAt(c[0], c[1], c[2], c[3], k / steps);
        run += Math.hypot((p.x - prev.x) * sx, (p.y - prev.y) * sy);
        lengths[k] = run;
        prev = p;
      }
      segments.push({ lengths });
    }
    // An open subpath's last anchor ends the last segment.
    if (!closed && sub.length > 0) at[sub.length - 1] = run;
    subpaths.push({ closed, first, at, length: run, segments });
    first += sub.length;
  });
  return { subpaths };
}

/** Arc lengths of the selected anchors on `sub`. */
function sourcesOn(sub: AnchorSubpathMeasure, selected: ReadonlySet<number>): number[] {
  const out: number[] = [];
  for (let i = 0; i < sub.at.length; i++) if (selected.has(sub.first + i)) out.push(sub.at[i]!);
  return out;
}

/** Distance along `sub` from arc length `s` to the nearest of `sources`. */
function distanceTo(sub: AnchorSubpathMeasure, sources: readonly number[], s: number): number {
  let best = Infinity;
  for (const src of sources) {
    let d = Math.abs(s - src);
    if (sub.closed) d = Math.min(d, sub.length - d);
    if (d < best) best = d;
  }
  return best;
}

/**
 * How much of an edit to the `selected` anchors each anchor receives: 1 for
 * a selected anchor, the falloff of its distance along the path for one
 * within `radius` of the nearest selected anchor on its subpath. Anchors
 * that receive nothing are absent, as are anchors on a subpath with no
 * selected anchor.
 */
export function softSelectionWeights(
  measure: AnchorPathMeasure,
  selected: Iterable<number>,
  radius: number,
  falloff: SoftFalloff,
): Map<number, number> {
  const sel = new Set(selected);
  const out = new Map<number, number>();
  for (const sub of measure.subpaths) {
    const sources = sourcesOn(sub, sel);
    if (sources.length === 0) continue;
    for (let i = 0; i < sub.at.length; i++) {
      const flat = sub.first + i;
      const w = sel.has(flat) ? 1 : softFalloff(falloff, distanceTo(sub, sources, sub.at[i]!), radius);
      if (w > 0) out.set(flat, w);
    }
  }
  return out;
}

/**
 * The stretches of path within `radius` of the `selected` anchors, as world
 * polylines drawn on `set`. `measure` is of the set the distances are taken
 * on — the path as it was when the edit began — and `set` the geometry to
 * draw on, which must have the same anchors. A stretch crossing the seam of a
 * closed subpath comes back as one run.
 */
export function softSelectionBand(
  measure: AnchorPathMeasure,
  set: AnchorSet,
  selected: Iterable<number>,
  radius: number,
): Point[][] {
  const sel = new Set(selected);
  const runs: Point[][] = [];
  measure.subpaths.forEach((sub, s) => {
    const sources = sourcesOn(sub, sel);
    const anchors = set.anchors[s];
    if (sources.length === 0 || !anchors) return;
    const inside = (len: number) => distanceTo(sub, sources, len) <= radius;
    const subRuns: Point[][] = [];
    let current: Point[] | null = null;
    let startsAtSeam = false;
    sub.segments.forEach((seg, i) => {
      const c = segmentControls(anchors, sub.closed, i);
      if (!c) return;
      const at = (t: number): Point => (isStraight(c) ? lerpPoint(c[0], c[3], t) : cubicPointAt(c[0], c[1], c[2], c[3], t));
      const steps = seg.lengths.length - 1;
      for (let k = 0; k <= steps; k++) {
        const len = seg.lengths[k]!;
        const t = k / steps;
        const isIn = inside(len);
        if (k === 0 && i === 0) startsAtSeam = isIn;
        if (k > 0) {
          const prevLen = seg.lengths[k - 1]!;
          const wasIn = inside(prevLen);
          if (wasIn !== isIn) {
            // The edge sits where the distance crosses `radius`, found by bisection on arc length.
            const edge = crossing(prevLen, len, wasIn, inside);
            const te = ((k - 1) + (len === prevLen ? 0 : (edge - prevLen) / (len - prevLen))) / steps;
            const p = at(te);
            if (wasIn) {
              current?.push(p);
              if (current) subRuns.push(current);
              current = null;
            } else {
              current = [p];
            }
          }
        }
        if (isIn) {
          current ??= [];
          const p = at(t);
          const last = current[current.length - 1];
          if (!last || last.x !== p.x || last.y !== p.y) current.push(p);
        }
      }
    });
    if (current) subRuns.push(current);
    // A closed subpath's last run and first run meet at its first anchor.
    if (sub.closed && startsAtSeam && subRuns.length > 1) {
      const head = subRuns.shift()!;
      subRuns[subRuns.length - 1]!.push(...head.slice(1));
    }
    runs.push(...subRuns.filter((r) => r.length >= 2));
  });
  return runs;
}

function crossing(a: number, b: number, aIn: boolean, inside: (s: number) => boolean): number {
  let lo = a;
  let hi = b;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (inside(mid) === aIn) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}


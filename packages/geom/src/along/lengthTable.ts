/** One subpath of a path flattened to straight segments, in pen order. */
export interface LengthRun {
  /** `dim` components per point. A closed run does not repeat its first point. */
  points: ArrayLike<number>;
  /** Whether a closing edge runs from the last point back to the first. */
  closed: boolean;
  /** Per point, the anchor before it, the anchor after it, and the arc-length
   *  fraction between them, as `Polyline` carries them. Absent, every point is
   *  an anchor, numbered on from the previous run's. */
  anchorA?: ArrayLike<number>;
  anchorB?: ArrayLike<number>;
  anchorT?: ArrayLike<number>;
  /** A closed run's last anchor when it sat on the first point and was dropped, as `Polyline` carries it. */
  closeAnchor?: number;
}

/** A path's arc length in pen order: subpaths in order, the lift between them covering no distance. */
export interface LengthTable {
  readonly dim: 2 | 3;
  readonly runs: readonly LengthRun[];
  /** Pen-order length, closing edges included. */
  readonly total: number;
  /** Where each run starts, `runs.length + 1` entries; the last is `total`. */
  readonly runStart: Float64Array;
  /** The anchor range: per subpath, the segments between its anchors, a closed one's closing edge included. */
  readonly segments: number;
}

/** @internal What the queries read, kept off the public shape. */
export interface LengthTableInternals {
  /** Per run, the pen-order length at each point, then at the closing edge's end for a closed run. */
  cum: Float64Array[];
  /** Authored anchor positions and their lengths, both ascending. */
  bpAnchor: Float64Array;
  bpLength: Float64Array;
  /** Per run, its first anchor and the anchor its last segment ends at. */
  runAnchor: Float64Array;
}

// A symbol rather than a side table, so a spread copy of a table still answers.
const INTERNALS = Symbol('lengthTable.internals');
type WithInternals = LengthTable & { [INTERNALS]?: LengthTableInternals };

/**
 * The length table of `runs`, in `dim` components per point. `anchorSources`
 * (from `resolveCornersWithSources`) maps the anchors of a corner-expanded path
 * back to the authored ones, so anchor queries answer in authored numbering:
 * an anchor rounded into an arc sits at the arc's midpoint.
 */
export function lengthTable(runs: readonly LengthRun[], dim: 2 | 3, anchorSources?: Uint32Array | null): LengthTable {
  const runStart = new Float64Array(runs.length + 1);
  const cum: Float64Array[] = [];
  let total = 0;
  runs.forEach((run, r) => {
    const c = runLengths(run, dim, total);
    cum.push(c);
    total = c[c.length - 1];
    runStart[r + 1] = total;
  });
  const anchors = anchorBreakpoints(runs, dim, cum, anchorSources ?? null);
  const table: WithInternals = { dim, runs, total, runStart, segments: anchors.segments };
  table[INTERNALS] = { cum, ...anchors };
  return table;
}

/** @internal */
export function tableInternals(t: LengthTable): LengthTableInternals {
  const hit = (t as WithInternals)[INTERNALS];
  if (!hit) throw new Error('LengthTable: not built by lengthTable(); build one with it rather than by hand');
  return hit;
}

/** The pen-order length at authored anchor position `anchor`; `3.5` is halfway
 *  along the segment from anchor 3 by length. Clamps to the path. */
export function lengthAtAnchor(t: LengthTable, anchor: number): number {
  if (Number.isNaN(anchor)) return NaN;
  const { bpAnchor, bpLength } = tableInternals(t);
  const n = bpAnchor.length;
  if (n === 0) return 0;
  if (anchor <= bpAnchor[0]) return bpLength[0];
  if (anchor >= bpAnchor[n - 1]) return bpLength[n - 1];
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (bpAnchor[mid] <= anchor) lo = mid;
    else hi = mid;
  }
  const span = bpAnchor[hi] - bpAnchor[lo];
  const f = span > 0 ? (anchor - bpAnchor[lo]) / span : 1;
  return bpLength[lo] + f * (bpLength[hi] - bpLength[lo]);
}

/** The authored anchor position at pen length `s`: the inverse of
 *  {@link lengthAtAnchor}. Where a pen lift puts two anchors at one length,
 *  the later. Clamps to the path. */
export function anchorAtLength(t: LengthTable, s: number): number {
  if (Number.isNaN(s)) return NaN;
  const { bpAnchor, bpLength } = tableInternals(t);
  const n = bpAnchor.length;
  if (n === 0) return 0;
  if (s <= bpLength[0]) return bpAnchor[0];
  if (s >= bpLength[n - 1]) return bpAnchor[n - 1];
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (bpLength[mid] <= s) lo = mid;
    else hi = mid;
  }
  const f = (s - bpLength[lo]) / (bpLength[hi] - bpLength[lo]);
  return bpAnchor[lo] + f * (bpAnchor[hi] - bpAnchor[lo]);
}

/** The pen-order length at the start of subpath `subpath`; a fractional part
 *  goes that share of the way along it by length. Clamps to the path. */
export function lengthAtSubpath(t: LengthTable, subpath: number): number {
  if (Number.isNaN(subpath)) return NaN;
  const n = t.runs.length;
  const c = Math.min(Math.max(subpath, 0), n);
  const i = Math.floor(c);
  if (i >= n) return t.total;
  return t.runStart[i] + (c - i) * (t.runStart[i + 1] - t.runStart[i]);
}

/** The pen-order length at fraction `f` of the anchor range: each segment an
 *  equal share, a pen lift none. Clamps to the path. */
export function lengthAtSegmentFraction(t: LengthTable, f: number): number {
  if (Number.isNaN(f)) return NaN;
  const c = Math.min(Math.max(f, 0), 1);
  if (t.segments <= 0) return c * t.total;
  const { runAnchor } = tableInternals(t);
  let s = c * t.segments;
  for (let r = 0; r < runAnchor.length / 2; r++) {
    const start = runAnchor[r * 2];
    const span = runAnchor[r * 2 + 1] - start;
    if (span > 0 && s <= span) return lengthAtAnchor(t, start + s);
    s -= Math.max(span, 0);
  }
  return t.total;
}

function runLengths(run: LengthRun, dim: number, base: number): Float64Array {
  const p = run.points;
  const n = Math.floor(p.length / dim);
  const wrap = run.closed && n >= 2;
  const c = new Float64Array(Math.max(n + (wrap ? 1 : 0), 1));
  c[0] = base;
  for (let i = 1; i < c.length; i++) {
    const a = (i - 1) * dim;
    const b = (i % n) * dim;
    let d2 = 0;
    for (let k = 0; k < dim; k++) d2 += (p[b + k] - p[a + k]) ** 2;
    c[i] = c[i - 1] + Math.sqrt(d2);
  }
  return c;
}

/** Per run, its anchor-aligned points as (expanded anchor, length) pairs, then
 *  folded into authored numbering. */
function anchorBreakpoints(
  runs: readonly LengthRun[], dim: number, cum: readonly Float64Array[], sources: Uint32Array | null,
): Omit<LengthTableInternals, 'cum'> & { segments: number } {
  const ids: number[] = [];
  const lens: number[] = [];
  const runAnchor = new Float64Array(runs.length * 2);
  let segments = 0;
  let next = 0;
  runs.forEach((run, r) => {
    const n = Math.floor(run.points.length / dim);
    const c = cum[r];
    const raw = expandedBreaks(run, n, c, next);
    next += n;
    const folded = foldToAuthored(raw, sources, run.closed && n >= 2);
    if (folded.ids.length === 0) return;
    const first = folded.ids[0];
    let last = folded.ids[folded.ids.length - 1];
    if (run.closed && n >= 2) {
      last += 1;
      folded.ids.push(last);
      folded.lens.push(c[c.length - 1]);
    }
    runAnchor[r * 2] = first;
    runAnchor[r * 2 + 1] = last;
    segments += last - first;
    ids.push(...folded.ids);
    lens.push(...folded.lens);
  });
  return { bpAnchor: Float64Array.from(ids), bpLength: Float64Array.from(lens), runAnchor, segments };
}

function expandedBreaks(run: LengthRun, n: number, c: Float64Array, next: number): { ids: number[]; lens: number[] } {
  const ids: number[] = [];
  const lens: number[] = [];
  const { anchorA: A, anchorB: B } = run;
  if (!A || !B) {
    for (let i = 0; i < n; i++) { ids.push(next + i); lens.push(c[i]); }
    return { ids, lens };
  }
  for (let i = 0; i < n; i++) {
    if (A[i] === B[i]) { ids.push(A[i]); lens.push(c[i]); }
  }
  // A last anchor dropped as a duplicate of the first point ends the closing edge's drawn part.
  const dropped = closingAnchor(run, n);
  if (dropped !== undefined) { ids.push(dropped); lens.push(c[n]); }
  return { ids, lens };
}

/**
 * The anchor a closed run's closing edge ends at when that anchor was dropped
 * as a duplicate of the first point: `closeAnchor`, else the anchor the last
 * point is heading toward. `undefined` when none was dropped, so the edge
 * ends at the run's first anchor. `n` is the run's point count.
 */
export function closingAnchor(run: LengthRun, n: number): number | undefined {
  const { anchorA: A, anchorB: B } = run;
  if (!run.closed || n < 2) return undefined;
  if (run.closeAnchor !== undefined) return run.closeAnchor;
  return A && B && A[n - 1] !== B[n - 1] ? B[n - 1] : undefined;
}

function foldToAuthored(
  raw: { ids: number[]; lens: number[] }, sources: Uint32Array | null, closed: boolean,
): { ids: number[]; lens: number[] } {
  const ids: number[] = [];
  const lens: number[] = [];
  let lo = 0;
  let hi = 0;
  const flush = () => { if (ids.length > lens.length) lens.push((lo + hi) / 2); };
  for (let i = 0; i < raw.ids.length; i++) {
    const id = sources ? (sources[raw.ids[i]] ?? raw.ids[i]) : raw.ids[i];
    const len = raw.lens[i];
    // A closed run's first anchor stays at its start; the arc rounding it is drawn last, so it joins the closing edge.
    if (closed && ids.length > 0 && id === ids[0]) continue;
    if (ids.length > 0 && id === ids[ids.length - 1]) { hi = len; continue; }
    flush();
    ids.push(id);
    lo = len;
    hi = len;
  }
  flush();
  return { ids, lens };
}

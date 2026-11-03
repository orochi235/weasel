/**
 * Lines as the line pass's vertices. Trimming happens here, on the CPU and in
 * the line's own space; widths and the head are pixels, laid out by the shader
 * once the camera is known.
 */

import { curveSpan, lengthTable, type CurveSpan } from '@weasel-js/geom';
import { transformPoint, type Mat4, type Vec3 } from '@weasel-js/geom/3d';
import type { StrokeTrim } from '@weasel-js/paint';
import { resolveTrim } from '@weasel-js/stroke';
import { HEAD, type HeadShape } from './head';

/** One subpath of a {@link Line3}: points joined by straight segments. */
export interface LineRun3 {
  points: readonly Vec3[];
  /** Whether a closing edge runs from the last point back to the first. */
  closed?: boolean;
}

/** A polyline drawn a fixed number of pixels wide, whatever its depth. */
export interface Line3 {
  /** Subpaths in pen order, which is the order a trim runs. */
  runs: readonly LineRun3[];
  /** Straight (not premultiplied) RGBA, each 0–1. */
  color: readonly [number, number, number, number];
  /** The shaft's width in CSS pixels. Default 4. */
  width?: number;
  /** The head at each open run's end; null for none. Default {@link HEAD}. */
  head?: HeadShape | null;
  /** The stretch drawn, measured in the line's own space. */
  trim?: StrokeTrim;
  /** From the line's own space to the world. Default identity. */
  model?: Mat4;
}

/** A visible stretch of a line: what the pass draws as one shaft and at most one head. */
export interface VisibleRun3 {
  /** In the line's own space. */
  points: Vec3[];
  closed: boolean;
  headed: boolean;
}

/** Floats per vertex; see {@link packLines} for the layout. */
export const LINE_FLOATS = 29;

/** Which point of its segment a vertex sits at. */
export const ROLE_BACK = 0;
export const ROLE_SHAFT_END = 1;
export const ROLE_HEAD_BASE = 2;
export const ROLE_TIP = 3;

/** `[role, side]` per vertex: two triangles of shaft, then the head's one. */
const SHAFT_CORNERS = [
  [ROLE_BACK, -1], [ROLE_BACK, 1], [ROLE_SHAFT_END, 1],
  [ROLE_BACK, -1], [ROLE_SHAFT_END, 1], [ROLE_SHAFT_END, -1],
] as const;
const HEAD_CORNERS = [[ROLE_HEAD_BASE, -1], [ROLE_HEAD_BASE, 1], [ROLE_TIP, 0]] as const;

const flat = (points: readonly Vec3[]): number[] => points.flatMap((p) => [p.x, p.y, p.z]);
const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 =>
  ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
const dist = (a: Vec3, b: Vec3): number => Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);

/**
 * The stretches of `line` its trim leaves, one per subpath the trim reaches.
 * A closed subpath the trim covers whole stays closed; one it cuts is open and,
 * as a closed subpath takes no marker, carries no head.
 */
export function visibleRuns(line: Line3): VisibleRun3[] {
  const runs = line.runs.filter((r) => r.points.length >= 2);
  if (runs.length === 0) return [];
  const table = lengthTable(runs.map((r) => ({ points: flat(r.points), closed: !!r.closed })), 3);
  const span = resolveTrim(table, line.trim);
  const cut = span && curveSpan(table, span);
  if (!cut) return [];
  const out: VisibleRun3[] = [];
  for (let r = cut.from.run; r <= cut.to.run; r++) {
    const run = windowRun(runs[r], r, cut);
    if (run) out.push({ ...run, headed: !run.closed && !runs[r].closed && line.head !== null });
  }
  return out;
}

function windowRun(run: LineRun3, r: number, cut: CurveSpan): { points: Vec3[]; closed: boolean } | null {
  const pts = run.points;
  const n = pts.length;
  const segments = run.closed ? n : n - 1;
  const at = (i: number) => pts[i % n];
  const from = r === cut.from.run ? cut.from : { segment: 0, t: 0 };
  const to = r === cut.to.run ? cut.to : { segment: segments - 1, t: 1 };
  if (run.closed && from.segment === 0 && from.t === 0 && to.segment === segments - 1 && to.t === 1) {
    return { points: [...pts], closed: true };
  }
  const out: Vec3[] = [lerp3(at(from.segment), at(from.segment + 1), from.t)];
  for (let k = from.segment + 1; k <= to.segment; k++) out.push(at(k));
  out.push(lerp3(at(to.segment), at(to.segment + 1), to.t));
  const kept = out.filter((p, i) => i === 0 || dist(out[i - 1], p) > 0);
  return kept.length >= 2 ? { points: kept, closed: false } : null;
}

/**
 * `lines` as the line pass draws them: six vertices a segment, three more for
 * a head, `LINE_FLOATS` floats each, laid out as
 *
 * | floats | holds |
 * |---|---|
 * | 0–2, 3–5 | the segment's two ends, in the world |
 * | 6–8 | the point past this vertex's own end, so the shaft can miter |
 * | 9, 10 | role and side |
 * | 11–13 | the segment's start and end along its run, and the run's length, in the line's own units |
 * | 14–17 | half the shaft's width in pixels, then the head's `lenRatio`, `maxShare` and `aspect` (`lenRatio` 0: no head) |
 * | 18–20, 21–23, 24 | the run's tip, the start of its last segment, and that segment's length: one screen scale for every vertex of the run |
 * | 25–28 | straight RGBA |
 */
export function packLines(lines: readonly Line3[]): Float32Array {
  const chunks: number[] = [];
  for (const line of lines) {
    const shaftHalf = (line.width ?? 4) / 2;
    const head = line.head === undefined ? HEAD : line.head;
    const toWorld = line.model ? (p: Vec3) => transformPoint(line.model!, p) : (p: Vec3) => p;
    for (const run of visibleRuns(line)) {
      packRun(chunks, run, run.points.map(toWorld), shaftHalf, run.headed ? head : null, line.color);
    }
  }
  return Float32Array.from(chunks);
}

function packRun(
  out: number[], run: VisibleRun3, world: readonly Vec3[], shaftHalf: number,
  head: HeadShape | null, color: Line3['color'],
): void {
  const n = world.length;
  const segments = run.closed ? n : n - 1;
  const at = (i: number) => world[((i % n) + n) % n];
  const along = [0];
  for (let i = 0; i < segments; i++) along.push(along[i] + dist(run.points[i], run.points[(i + 1) % n]));
  const total = along[segments];
  const apex = at(segments);
  const apexBack = at(segments - 1);
  const reach = total - along[segments - 1];
  const shape = head ? [head.lenRatio, head.maxShare, head.aspect] : [0, 0, 0];
  for (let i = 0; i < segments; i++) {
    const a = at(i);
    const b = at(i + 1);
    // A free end has no neighbor; pointing at itself, it keeps its own perpendicular.
    const before = run.closed || i > 0 ? at(i - 1) : a;
    const after = run.closed || i + 2 <= n - 1 ? at(i + 2) : b;
    const corners = head && i === segments - 1 ? [...SHAFT_CORNERS, ...HEAD_CORNERS] : SHAFT_CORNERS;
    for (const [role, side] of corners) {
      const adj = role === ROLE_BACK ? before : role === ROLE_SHAFT_END ? after : b;
      out.push(
        a.x, a.y, a.z, b.x, b.y, b.z, adj.x, adj.y, adj.z, role, side,
        along[i], along[i + 1], total, shaftHalf, ...shape,
        apex.x, apex.y, apex.z, apexBack.x, apexBack.y, apexBack.z, reach,
        ...color,
      );
    }
  }
}

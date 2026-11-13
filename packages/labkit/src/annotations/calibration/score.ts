import { MARK_COLOR, MARK_WIDTH } from '../paint';
import type { Annotation } from '../types';
import type { Box, Exercise, Guide, Pt } from './exercises';

/** Pass at ≤ 2 screen px per geometric error; a freehand stroke passes at a mean ≤ 2 px and a max ≤ 6 px. */
export const PASS_PX = 2;
export const FREEHAND_MAX_PX = 6;

export type ScoreStatus = 'pass' | 'fail' | 'missing';

/** How one exercise came out. Errors are in content units and in screen px. */
export interface ExerciseScore {
  id: string;
  status: ScoreStatus;
  markId?: string;
  /** The exercise's headline error: the worst edge or endpoint, a stroke's mean distance, a text label's offset. */
  error?: number;
  errorPx?: number;
  /** A stroke's furthest point from its guide. */
  max?: number;
  maxPx?: number;
  /** A text label's origin lies inside its guide box. */
  inside?: boolean;
  width?: { expected: number; actual: number; ok: boolean };
  color?: { expected: string; actual: string; ok: boolean };
  reason?: string;
}

type Size = { w: number; h: number };

/** An error in content units as screen px, for a target drawn at `pxPerUnit` screen px per content unit. */
export function toScreenPx(error: number, pxPerUnit: number): number {
  return error * pxPerUnit;
}

const dist = (a: Pt, b: Pt): number => Math.hypot(a.x - b.x, a.y - b.y);

function markBox(m: Annotation, content: Size): Box {
  return {
    x: m.frac.x * content.w,
    y: m.frac.y * content.h,
    w: m.frac.w * content.w,
    h: m.frac.h * content.h,
  };
}

function markPoints(m: Annotation, content: Size): Pt[] {
  return (m.points ?? []).map((p) => ({ x: p.x * content.w, y: p.y * content.h }));
}

function inBox(p: Pt, b: Box, slack = 0): boolean {
  return (
    p.x >= b.x - slack && p.x <= b.x + b.w + slack && p.y >= b.y - slack && p.y <= b.y + b.h + slack
  );
}

/** The worst of the four edges' differences. */
export function boxError(mark: Box, guide: Box): number {
  return Math.max(
    Math.abs(mark.x - guide.x),
    Math.abs(mark.y - guide.y),
    Math.abs(mark.x + mark.w - (guide.x + guide.w)),
    Math.abs(mark.y + mark.h - (guide.y + guide.h)),
  );
}

/** The further endpoint's distance, with the ends paired as given. */
export function segmentError(a: Pt, b: Pt, ga: Pt, gb: Pt): number {
  return Math.max(dist(a, ga), dist(b, gb));
}

function toSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** The distance from `p` to the nearest part of the polyline through `curve`. */
export function distanceToCurve(p: Pt, curve: readonly Pt[]): number {
  if (curve.length === 1) return dist(p, curve[0] as Pt);
  let best = Number.POSITIVE_INFINITY;
  for (let i = 1; i < curve.length; i++) {
    best = Math.min(best, toSegment(p, curve[i - 1] as Pt, curve[i] as Pt));
  }
  return best;
}

/** Mean and max distance from a stroke's points to its guide curve. */
export function curveError(
  points: readonly Pt[],
  curve: readonly Pt[],
): { mean: number; max: number } {
  if (points.length === 0 || curve.length === 0) return { mean: Infinity, max: Infinity };
  let sum = 0;
  let max = 0;
  for (const p of points) {
    const d = distanceToCurve(p, curve);
    sum += d;
    max = Math.max(max, d);
  }
  return { mean: sum / points.length, max };
}

interface Geometry {
  error: number;
  max?: number;
  inside?: boolean;
  reversed?: boolean;
}

function endsOf(m: Annotation, content: Size): [Pt, Pt] | null {
  const pts = markPoints(m, content);
  return pts.length >= 2 ? [pts[0] as Pt, pts[pts.length - 1] as Pt] : null;
}

function segmentGeometry(
  ex: Exercise,
  guide: Extract<Guide, { kind: 'segment' }>,
  m: Annotation,
  content: Size,
): Geometry | null {
  const ends = endsOf(m, content);
  if (!ends) return null;
  const [a, b] = ends;
  const forward = segmentError(a, b, guide.a, guide.b);
  const backward = segmentError(b, a, guide.a, guide.b);
  if (ex.expect === 'arrow') return { error: forward, reversed: backward < forward };
  return { error: Math.min(forward, backward) };
}

/** The mark's geometric error against the exercise's guide, or null for a mark that has no geometry to compare. */
function geometry(ex: Exercise, m: Annotation, content: Size): Geometry | null {
  const g = ex.guide;
  if (g.kind === 'segment') return segmentGeometry(ex, g, m, content);
  if (g.kind === 'curve') {
    const pts = markPoints(m, content);
    if (pts.length === 0) return null;
    const { mean, max } = curveError(pts, g.points);
    return { error: mean, max };
  }
  const box = markBox(m, content);
  if (ex.expect === 'text') {
    const origin = { x: box.x, y: box.y };
    return { error: dist(origin, g.box), inside: inBox(origin, g.box, 1e-6) };
  }
  return { error: boxError(box, g.box) };
}

const center = (b: Box): Pt => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

/** Whether a mark sits in the exercise's cell: its bounds' center does, or a text label's origin. */
function inArea(ex: Exercise, m: Annotation, content: Size): boolean {
  const box = markBox(m, content);
  return inBox(ex.expect === 'text' ? box : center(box), ex.area);
}

function normalColor(c: string): string {
  return c.trim().toLowerCase();
}

function failure(ex: Exercise, g: Geometry, pxPerUnit: number): string | undefined {
  if (g.reversed) return 'reversed: drawn from B to A';
  if (g.inside === false) return 'starts outside the box';
  const px = toScreenPx(g.error, pxPerUnit);
  if (ex.guide.kind === 'curve') {
    const maxPx = toScreenPx(g.max ?? 0, pxPerUnit);
    if (px > PASS_PX) return `mean ${px.toFixed(2)} px > ${PASS_PX}`;
    if (maxPx > FREEHAND_MAX_PX) return `max ${maxPx.toFixed(2)} px > ${FREEHAND_MAX_PX}`;
    return undefined;
  }
  return px > PASS_PX ? `${px.toFixed(2)} px > ${PASS_PX}` : undefined;
}

function styleChecks(ex: Exercise, m: Annotation): Pick<ExerciseScore, 'width' | 'color'> {
  const out: Pick<ExerciseScore, 'width' | 'color'> = {};
  if (ex.width !== undefined) {
    const actual = m.width ?? MARK_WIDTH;
    out.width = { expected: ex.width, actual, ok: Math.abs(actual - ex.width) < 1e-6 };
  }
  if (ex.color !== undefined) {
    const actual = m.color ?? MARK_COLOR;
    out.color = { expected: ex.color, actual, ok: normalColor(actual) === normalColor(ex.color) };
  }
  return out;
}

function missing(ex: Exercise, marks: readonly Annotation[], content: Size): ExerciseScore {
  const other = marks.find((m) => m.kind !== ex.expect && inArea(ex, m, content));
  return {
    id: ex.id,
    status: 'missing',
    ...(other ? { reason: `found a ${other.kind}, expected a ${ex.expect}` } : {}),
  };
}

/** One exercise's score: the mark of the expected kind in its cell that fits its guide best. */
export function scoreExercise(
  ex: Exercise,
  marks: readonly Annotation[],
  content: Size,
  pxPerUnit: number,
): ExerciseScore {
  let best: { m: Annotation; g: Geometry } | null = null;
  for (const m of marks) {
    if (m.kind !== ex.expect || !inArea(ex, m, content)) continue;
    const g = geometry(ex, m, content);
    if (g && (!best || g.error < best.g.error)) best = { m, g };
  }
  if (!best) return missing(ex, marks, content);
  const { m, g } = best;
  const style = styleChecks(ex, m);
  const reasons = [
    failure(ex, g, pxPerUnit),
    style.width && !style.width.ok
      ? `width ${style.width.actual}, expected ${ex.width}`
      : undefined,
    style.color && !style.color.ok
      ? `color ${style.color.actual}, expected ${ex.color}`
      : undefined,
  ].filter((r): r is string => r !== undefined);
  return {
    id: ex.id,
    status: reasons.length === 0 ? 'pass' : 'fail',
    markId: m.id,
    error: g.error,
    errorPx: toScreenPx(g.error, pxPerUnit),
    ...(g.max !== undefined ? { max: g.max, maxPx: toScreenPx(g.max, pxPerUnit) } : {}),
    ...(g.inside !== undefined ? { inside: g.inside } : {}),
    ...style,
    ...(reasons.length > 0 ? { reason: reasons.join('; ') } : {}),
  };
}

/** Every exercise's score, in exercise order. */
export function scoreAll(
  exercises: readonly Exercise[],
  marks: readonly Annotation[],
  content: Size,
  pxPerUnit: number,
): ExerciseScore[] {
  return exercises.map((ex) => scoreExercise(ex, marks, content, pxPerUnit));
}

/**
 * The small marks the path-edit overlay draws for a path's constraints, in
 * screen pixels, and where a click finds them: a letter beside a horizontal
 * or vertical segment, paired strokes beside parallel ones, a foot beside
 * perpendicular ones, ticks across equal ones, a dimension bar beside a fixed
 * length, a pin by a fixed anchor, a ring by coincident ones, a line
 * touching a circle by a tangent one, and a dot on a line by one held on a
 * segment. Marks sit
 * on the inside of the shape, toward the centroid of its anchors, so a click
 * on one lands on the shape rather than on empty canvas.
 */

import type { DrawCommand } from '@weasel-js/renderer';
import { constraintFits, PathBuilder, type AnchorPair, type PathConstraint } from '@weasel-js/geom';

interface Pt {
  x: number;
  y: number;
}

/** How far a mark sits off its segment or anchor. */
const OFFSET = 12;

/** Colors for the constraint marks. */
export interface ConstraintGlyphStyle {
  /** A constraint that holds. */
  stroke: string;
  /** One that does not: it conflicts with the others. */
  conflictStroke: string;
}

const at = (p: Pt, d: Pt, k: number): Pt => ({ x: p.x + d.x * k, y: p.y + d.y * k });

function line(b: PathBuilder, p: Pt, q: Pt): void {
  b.moveTo(p.x, p.y).lineTo(q.x, q.y);
}

function centroidOf(points: readonly Pt[]): Pt {
  const n = points.length || 1;
  return { x: points.reduce((s, p) => s + p.x, 0) / n, y: points.reduce((s, p) => s + p.y, 0) / n };
}

/** The unit vector from `p` toward `to`, or straight down when they meet. */
function toward(p: Pt, to: Pt): Pt {
  const len = Math.hypot(to.x - p.x, to.y - p.y);
  return len > 1e-9 ? { x: (to.x - p.x) / len, y: (to.y - p.y) / len } : { x: 0, y: 1 };
}

/** The segment's midpoint, direction, the inward normal its marks sit along, and where its mark sits. */
function frameOf(points: readonly Pt[], [i, j]: AnchorPair, inside: Pt) {
  const a = points[i];
  const c = points[j];
  const len = Math.hypot(c.x - a.x, c.y - a.y);
  const u = len > 1e-9 ? { x: (c.x - a.x) / len, y: (c.y - a.y) / len } : { x: 1, y: 0 };
  const m = { x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 };
  const left = { x: -u.y, y: u.x };
  const n = left.x * (inside.x - m.x) + left.y * (inside.y - m.y) < 0 ? { x: u.y, y: -u.x } : left;
  return { m, u, n, o: at(m, n, OFFSET) };
}

function segmentsOf(c: PathConstraint): readonly AnchorPair[] {
  switch (c.kind) {
    case 'fixed':
    case 'tangent':
    case 'onPath':
    case 'coincident': return [];
    case 'horizontal':
    case 'vertical':
    case 'length': return [c.segment];
    default: return c.segments;
  }
}

/** Where `c`'s marks sit, one point per mark. */
function markCenters(points: readonly Pt[], c: PathConstraint, inside: Pt): Pt[] {
  if (c.kind === 'fixed' || c.kind === 'tangent' || c.kind === 'onPath' || c.kind === 'coincident') {
    const p = points[c.kind === 'coincident' ? c.anchors[0] : c.anchor];
    return [at(p, toward(p, inside), c.kind === 'fixed' ? 11 : 13)];
  }
  return segmentsOf(c).map((s) => {
    const f = frameOf(points, s, inside);
    return c.kind === 'equalLength' ? f.m : f.o;
  });
}

function letter(b: PathBuilder, o: Pt, which: 'H' | 'V'): void {
  if (which === 'H') {
    line(b, { x: o.x - 3, y: o.y - 4 }, { x: o.x - 3, y: o.y + 4 });
    line(b, { x: o.x + 3, y: o.y - 4 }, { x: o.x + 3, y: o.y + 4 });
    line(b, { x: o.x - 3, y: o.y }, { x: o.x + 3, y: o.y });
  } else {
    b.moveTo(o.x - 3, o.y - 4).lineTo(o.x, o.y + 4).lineTo(o.x + 3, o.y - 4);
  }
}

function segmentMark(b: PathBuilder, points: readonly Pt[], kind: PathConstraint['kind'], s: AnchorPair, inside: Pt): void {
  const { m, u, n, o } = frameOf(points, s, inside);
  switch (kind) {
    case 'parallel':
      for (const k of [-2, 2]) line(b, at(at(o, n, k), u, -4), at(at(o, n, k), u, 4));
      return;
    case 'perpendicular':
      line(b, at(o, u, -4), at(o, u, 4));
      line(b, o, at(o, n, 7));
      return;
    case 'equalLength':
      for (const k of [-2, 2]) line(b, at(at(m, u, k), n, -4), at(at(m, u, k), n, 4));
      return;
    case 'length':
      line(b, at(o, u, -8), at(o, u, 8));
      for (const k of [-8, 8]) line(b, at(at(o, u, k), n, -3), at(at(o, u, k), n, 3));
      return;
    default:
      letter(b, o, kind === 'vertical' ? 'V' : 'H');
  }
}

function glyphOf(b: PathBuilder, points: readonly Pt[], c: PathConstraint, inside: Pt): void {
  switch (c.kind) {
    case 'fixed': {
      // A pin standing on the anchor, pointing at it from inside the shape.
      const p = points[c.anchor];
      const d = toward(p, inside);
      const side = { x: -d.y, y: d.x };
      b.moveTo(...xy(at(p, d, 6))).lineTo(...xy(at(at(p, d, 14), side, -5)))
        .lineTo(...xy(at(at(p, d, 14), side, 5))).close();
      line(b, at(at(p, d, 17), side, -7), at(at(p, d, 17), side, 7));
      return;
    }
    case 'coincident': {
      // A ring inside the shape, tied to the anchor by a short stem.
      const p = points[c.anchors[0]];
      const d = toward(p, inside);
      const ring = at(p, d, 13);
      line(b, at(p, d, 6), at(p, d, 9));
      circle(b, ring, 4);
      return;
    }
    case 'tangent': {
      // A circle inside the shape and a line touching it on the anchor's side.
      const p = points[c.anchor];
      const d = toward(p, inside);
      const ring = at(p, d, 13);
      const side = { x: -d.y, y: d.x };
      const touch = at(ring, d, -4);
      line(b, at(touch, side, -6), at(touch, side, 6));
      circle(b, ring, 4);
      return;
    }
    case 'onPath': {
      // A dot on a short line, inside the shape by the anchor.
      const p = points[c.anchor];
      const d = toward(p, inside);
      const dot = at(p, d, 13);
      const side = { x: -d.y, y: d.x };
      line(b, at(dot, side, -7), at(dot, side, 7));
      circle(b, dot, 2.5);
      return;
    }
    default:
      for (const s of segmentsOf(c)) segmentMark(b, points, c.kind, s, inside);
  }
}

function circle(b: PathBuilder, o: Pt, r: number): void {
  b.moveTo(o.x + r, o.y);
  for (let k = 1; k <= 12; k++) b.lineTo(o.x + r * Math.cos((k * Math.PI) / 6), o.y + r * Math.sin((k * Math.PI) / 6));
}

const xy = (p: Pt): [number, number] => [p.x, p.y];

/**
 * Draw commands marking `constraints` on anchors at the screen positions
 * `points`, one per constraint, in `style.conflictStroke` for those listed
 * in `unsatisfied` and `style.stroke` for the rest; the one at `selected` is
 * drawn heavier. A constraint naming an anchor `points` does not have draws
 * nothing.
 */
export function constraintGlyphs(
  points: readonly Pt[],
  constraints: readonly PathConstraint[],
  unsatisfied: ReadonlySet<number>,
  style: ConstraintGlyphStyle,
  selected: number | null = null,
): DrawCommand[] {
  const inside = centroidOf(points);
  const out: DrawCommand[] = [];
  constraints.forEach((c, i) => {
    if (!constraintFits(c, points.length)) return;
    const b = new PathBuilder();
    glyphOf(b, points, c, inside);
    const color = unsatisfied.has(i) ? style.conflictStroke : style.stroke;
    out.push({ kind: 'path', path: b.build(), stroke: { paint: { kind: 'solid', color }, width: i === selected ? 3 : 1.5 } });
  });
  return out;
}

/**
 * The index of the constraint whose mark is nearest `p`, within `radius`,
 * for marks drawn on anchors at the screen positions `points`; -1 for none.
 */
export function constraintMarkAt(
  points: readonly Pt[],
  constraints: readonly PathConstraint[],
  p: Pt,
  radius: number,
): number {
  const inside = centroidOf(points);
  let best = -1;
  let bestD = radius;
  constraints.forEach((c, i) => {
    if (!constraintFits(c, points.length)) return;
    for (const m of markCenters(points, c, inside)) {
      const d = Math.hypot(m.x - p.x, m.y - p.y);
      if (d <= bestD) {
        bestD = d;
        best = i;
      }
    }
  });
  return best;
}

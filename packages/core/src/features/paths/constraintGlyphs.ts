/**
 * The small marks the path-edit overlay draws for a path's constraints, in
 * screen pixels: a letter beside a horizontal or vertical segment, paired
 * strokes beside parallel ones, a foot beside perpendicular ones, ticks across
 * equal ones, a dimension bar beside a fixed length, a pin under a fixed
 * anchor, and a ring round coincident ones.
 */

import type { DrawCommand } from '@weasel-js/renderer';
import { constraintFits, PathBuilder, type AnchorPair, type PathConstraint } from '@weasel-js/geom';

interface Pt {
  x: number;
  y: number;
}

/** How far a mark sits off its segment. */
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

/** The segment's midpoint, direction, and the normal its marks sit along. */
function frameOf(points: readonly Pt[], [i, j]: AnchorPair) {
  const a = points[i];
  const c = points[j];
  const len = Math.hypot(c.x - a.x, c.y - a.y);
  const u = len > 1e-9 ? { x: (c.x - a.x) / len, y: (c.y - a.y) / len } : { x: 1, y: 0 };
  const n = { x: -u.y, y: u.x };
  const m = { x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 };
  return { m, u, n, o: at(m, n, OFFSET) };
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

function segmentMark(b: PathBuilder, points: readonly Pt[], kind: PathConstraint['kind'], s: AnchorPair): void {
  const { m, u, n, o } = frameOf(points, s);
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

function glyphOf(b: PathBuilder, points: readonly Pt[], c: PathConstraint): void {
  switch (c.kind) {
    case 'fixed': {
      const p = points[c.anchor];
      b.moveTo(p.x, p.y + 6).lineTo(p.x - 5, p.y + 14).lineTo(p.x + 5, p.y + 14).close();
      line(b, { x: p.x - 7, y: p.y + 17 }, { x: p.x + 7, y: p.y + 17 });
      return;
    }
    case 'coincident': {
      const p = points[c.anchors[0]];
      b.moveTo(p.x + 9, p.y);
      for (let k = 1; k <= 16; k++) b.lineTo(p.x + 9 * Math.cos((k * Math.PI) / 8), p.y + 9 * Math.sin((k * Math.PI) / 8));
      return;
    }
    case 'horizontal':
    case 'vertical':
    case 'length':
      segmentMark(b, points, c.kind, c.segment);
      return;
    default:
      for (const s of c.segments) segmentMark(b, points, c.kind, s);
  }
}

/**
 * Draw commands marking `constraints` on anchors at the screen positions
 * `points`, one per constraint, in `style.conflictStroke` for those listed
 * in `unsatisfied` and `style.stroke` for the rest. A constraint naming an
 * anchor `points` does not have draws nothing.
 */
export function constraintGlyphs(
  points: readonly Pt[],
  constraints: readonly PathConstraint[],
  unsatisfied: ReadonlySet<number>,
  style: ConstraintGlyphStyle,
): DrawCommand[] {
  const out: DrawCommand[] = [];
  constraints.forEach((c, i) => {
    if (!constraintFits(c, points.length)) return;
    const b = new PathBuilder();
    glyphOf(b, points, c);
    const color = unsatisfied.has(i) ? style.conflictStroke : style.stroke;
    out.push({ kind: 'path', path: b.build(), stroke: { paint: { kind: 'solid', color }, width: 1.5 } });
  });
  return out;
}

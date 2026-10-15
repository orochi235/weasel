/**
 * Where path edit puts a corner's widget: inside the corner, at the middle
 * of its cut, pushed a fixed distance further in on screen so that it clears
 * the anchor square at a zero radius. The overlay paints it and the
 * affordance hit-tests it from this one placement.
 */
import {
  cornerFrames, cornerShapeK, cornerShapePieces, cornerSpecAt, PathBuilder, standoff,
  type CornerFrame, type PolygonPath, type Scale2, type View,
} from '@weasel-js/geom';
import type { DrawCommand } from '@weasel-js/renderer';

/** Screen distance from the middle of a corner's cut to its widget. */
export const CORNER_WIDGET_STANDOFF_PX = 14;

/** Below this half-angle short of straight, an anchor is too flat to offer a
 *  widget; a freehand stroke would otherwise wear one at every vertex. */
const MIN_WIDGET_TURN = 0.05;

/** The corner anchors of `path` that show a widget. */
export function cornerWidgetFrames(path: PolygonPath): CornerFrame[] {
  return cornerFrames(path).filter((f) => f.halfAngle < Math.PI / 2 - MIN_WIDGET_TURN);
}

/** The middle of the corner's cut, in world coords: the anchor itself while
 *  the corner has no radius. */
export function cornerCutMiddle(frame: CornerFrame): { x: number; y: number } {
  const d = frame.trim * Math.cos(frame.halfAngle);
  return { x: frame.x + frame.bisector.x * d, y: frame.y + frame.bisector.y * d };
}

/** The widget's position in world coords under a view of `scale`. */
export function cornerWidgetAt(frame: CornerFrame, scale: Scale2): { x: number; y: number } {
  const at = standoff(cornerCutMiddle(frame), frame.bisector, CORNER_WIDGET_STANDOFF_PX, scale);
  return { x: at.x, y: at.y };
}

/** Half the side of a widget's glyph, in screen pixels. */
const GLYPH_HALF_PX = 4.5;

/** Paint for the widgets. */
export interface CornerWidgetPaint {
  fill: string;
  stroke: string;
}

type V = { x: number; y: number };

/** A square glyph centered at `c` whose corner facing along `toward` is
 *  cut by the superellipse of parameter `k`: the shape the corner has, drawn
 *  small and turned to face it. */
function cornerGlyph(c: V, toward: V, k: number): PolygonPath {
  const h = GLYPH_HALF_PX;
  const r2 = Math.SQRT1_2;
  const e1 = { x: (toward.x - toward.y) * r2, y: (toward.x + toward.y) * r2 };
  const e2 = { x: (toward.x + toward.y) * r2, y: (toward.y - toward.x) * r2 };
  const at = (a: number, b: number): V => ({ x: c.x + a * e1.x + b * e2.x, y: c.y + a * e1.y + b * e2.y });
  const cut = 1.2 * h;
  const outer = at(h, h);
  const b = new PathBuilder().moveTo(at(-h, -h).x, at(-h, -h).y).lineTo(at(h, -h).x, at(h, -h).y);
  const start = at(h, h - cut);
  b.lineTo(start.x, start.y);
  for (const piece of cornerShapePieces(k, { start, end: at(h - cut, h), outer })) {
    if (piece.kind === 'line') b.lineTo(piece.to.x, piece.to.y);
    else b.curveTo(piece.c1.x, piece.c1.y, piece.c2.x, piece.c2.y, piece.to.x, piece.to.y);
  }
  const last = at(-h, h);
  return b.lineTo(last.x, last.y).close().build();
}

/**
 * The widget of every corner anchor of `path`, in screen space: a small
 * square whose corner toward the anchor is cut in the corner's shape. A
 * corner with no spec draws as round, the shape a drag gives it.
 */
export function cornerWidgetCommands(path: PolygonPath, view: View, paint: CornerWidgetPaint): DrawCommand[] {
  const out: DrawCommand[] = [];
  const fill = { paint: { kind: 'solid' as const, color: paint.fill } };
  const stroke = { paint: { kind: 'solid' as const, color: paint.stroke }, width: 1 };
  for (const frame of cornerWidgetFrames(path)) {
    const w = cornerWidgetAt(frame, view.scale);
    const x = (w.x - view.x) * view.scale.x;
    const y = (w.y - view.y) * view.scale.y;
    // On screen, the anchor lies back along the bisector.
    const bx = -frame.bisector.x * view.scale.x, by = -frame.bisector.y * view.scale.y;
    const bl = Math.hypot(bx, by) || 1;
    const k = cornerShapeK(cornerSpecAt(path, frame.index)?.shape ?? 'round');
    out.push({ kind: 'path', path: cornerGlyph({ x, y }, { x: bx / bl, y: by / bl }, k), fill, stroke });
  }
  return out;
}

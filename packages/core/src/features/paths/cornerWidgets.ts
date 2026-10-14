/**
 * Where path edit puts a corner's widget: inside the corner, at the middle
 * of its cut, pushed a fixed distance further in on screen so that it clears
 * the anchor square at a zero radius. The overlay paints it and the
 * affordance hit-tests it from this one placement.
 */
import {
  circlePath, cornerSpecAt, cornerFrames, polygonFromPoints, standoff,
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

/** Screen size of a widget's glyph. */
const WIDGET_RADIUS_PX = 4;

/** Paint for the widgets. */
export interface CornerWidgetPaint {
  fill: string;
  stroke: string;
}

/**
 * The widget of every corner anchor of `path`, in screen space: a circle for
 * a round corner, a diamond for a chamfer, and a ring around a dot for an
 * inverted one. A corner with no spec draws as round, the style a drag gives it.
 */
export function cornerWidgetCommands(path: PolygonPath, view: View, paint: CornerWidgetPaint): DrawCommand[] {
  const out: DrawCommand[] = [];
  const fill = { paint: { kind: 'solid' as const, color: paint.fill } };
  const stroke = { paint: { kind: 'solid' as const, color: paint.stroke }, width: 1 };
  for (const frame of cornerWidgetFrames(path)) {
    const w = cornerWidgetAt(frame, view.scale);
    const x = (w.x - view.x) * view.scale.x;
    const y = (w.y - view.y) * view.scale.y;
    const r = WIDGET_RADIUS_PX;
    const style = cornerSpecAt(path, frame.index)?.style ?? 'round';
    if (style === 'chamfer') {
      const diamond = polygonFromPoints([
        { x, y: y - r - 1 }, { x: x + r + 1, y }, { x, y: y + r + 1 }, { x: x - r - 1, y },
      ]);
      out.push({ kind: 'path', path: diamond, fill, stroke });
    } else if (style === 'inverted') {
      out.push({ kind: 'path', path: circlePath(x, y, r), fill, stroke });
      out.push({ kind: 'path', path: circlePath(x, y, r / 2), fill: { paint: stroke.paint } });
    } else {
      out.push({ kind: 'path', path: circlePath(x, y, r), fill, stroke });
    }
  }
  return out;
}

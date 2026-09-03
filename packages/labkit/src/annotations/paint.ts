import type { DrawCommand, Path, Stroke } from '@weasel-js/core';
import {
  ellipsePath,
  linePath,
  markerDrawCommands,
  PathBuilder,
  rectPath,
  textCommand,
} from '@weasel-js/core';
import type { WorldRect } from './frac';
import type { AnnotationData, FracPoint } from './types';

/** One loud color, not a themed one: a mark sits over the instrument's own
 *  picture and has to be legible against whatever that picture is. */
const MARK_COLOR = '#e5484d';
/** World units, so a mark thickens with the picture it annotates — and so the
 *  marker geometry can be resolved here, which needs a resolved width. */
const MARK_WIDTH = 2;
const TEXT_SIZE = 14;

/** The subset of a mark's scene node this needs: where it is, and what it is. */
export interface PaintableMark {
  pose: WorldRect;
  data: AnnotationData;
}

/** How a mark is drawn, as opposed to where. Resolved by the overlay from the
 *  instrument's vocabulary and the mark's own staleness. */
export interface MarkStyle {
  /** The status's colour, or the default. */
  color?: string;
  /** A mark whose stored position no longer describes the picture. Drawn
   *  dashed rather than hidden: it still describes *something*, and dropping
   *  it would lose it. */
  stale?: boolean;
}

const toWorld = (p: FracPoint, content: { w: number; h: number }) => ({
  x: p.x * content.w,
  y: p.y * content.h,
});

/** A mark's stored vertices in world units, or the pose's diagonal — a stored
 *  mark whose `points` did not survive still has to draw somewhere. */
function vertices(m: PaintableMark, content: { w: number; h: number }): { x: number; y: number }[] {
  const stored = m.data.points;
  if (stored && stored.length >= 2) return stored.map((p) => toWorld(p, content));
  const { x, y, width, height } = m.pose;
  return [
    { x, y },
    { x: x + width, y: y + height },
  ];
}

function polyline(points: { x: number; y: number }[]): Path {
  const b = new PathBuilder();
  const first = points[0];
  if (!first) return rectPath(0, 0, 0, 0);
  b.moveTo(first.x, first.y);
  for (const p of points.slice(1)) b.lineTo(p.x, p.y);
  return b.build();
}

/**
 * What one mark draws, in its target's world.
 *
 * Pure: a node and the target's content box in, draw commands out. Geometry
 * that a bounding box cannot describe — a line's ends, a stroke's path — comes
 * from `data.points`, which is in fractions like the bounds.
 */
export function markCommands(
  m: PaintableMark,
  content: { w: number; h: number },
  style: MarkStyle = {},
): DrawCommand[] {
  const color = style.color ?? MARK_COLOR;
  const stroke: Stroke = {
    paint: { color },
    width: MARK_WIDTH,
    cap: 'round',
    join: 'round',
    ...(style.stale ? { dash: [6, 4] } : {}),
  };

  switch (m.data.kind) {
    case 'rect':
      return [
        { kind: 'path', path: rectPath(m.pose.x, m.pose.y, m.pose.width, m.pose.height), stroke },
      ];
    case 'ellipse':
      return [{ kind: 'path', path: ellipsePath(m.pose), stroke }];
    case 'line': {
      const [a, b] = vertices(m, content);
      return [{ kind: 'path', path: linePath(a, b), stroke }];
    }
    case 'arrow': {
      const [a, b] = vertices(m, content);
      // The spec's arrow: a line carrying an end marker, not its own geometry.
      // Markers are separate commands — a stroke's `markerEnd` is inert unless
      // something turns it into geometry, and only the kit's own node painter
      // does that, for the nodes it owns.
      const marked: Stroke = { ...stroke, markerEnd: 'arrow' };
      const path = linePath(a, b);
      return [
        { kind: 'path', path, stroke: marked },
        ...markerDrawCommands(path, marked, MARK_WIDTH, undefined),
      ];
    }
    case 'stroke':
      return [{ kind: 'path', path: polyline(vertices(m, content)), stroke }];
    case 'text': {
      const text = m.data.title;
      if (!text) return [];
      return [
        textCommand(
          m.pose.x,
          m.pose.y,
          text,
          { fontSize: TEXT_SIZE },
          undefined,
          undefined,
          undefined,
          {
            fill: { color },
          },
        ),
      ];
    }
  }
}

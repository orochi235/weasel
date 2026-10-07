import type { DrawCommand, NodeShapeEntry, Path, Stroke, View } from '@weasel-js/core';
import {
  ellipsePath,
  HANDLE_BASE_PX,
  linePath,
  PathBuilder,
  pxExtent,
  rectPath,
  textCommand,
} from '@weasel-js/core';
import { boxOf, fromShape, type WorldRect } from './frac';
import type { AnnotationData } from './types';

/** One loud color, not a themed one: a mark sits over the instrument's own
 *  picture and has to be legible against whatever that picture is. */
const MARK_COLOR = '#e5484d';
/** World units, so a mark thickens with the picture it annotates. */
const MARK_WIDTH = 2;
const TEXT_SIZE = 14;
const STALE_DASH = [6, 4];
/** Screen pixels: a point marks a place rather than a region of the picture,
 *  so it holds its size like a selection handle. */
const POINT_RADIUS_PX = HANDLE_BASE_PX / 2;
const UNIT_SCALE: View['scale'] = { x: 1, y: 1 };

/** The subset of a mark's scene node this needs: where it is, and what it is. */
export interface PaintableMark {
  pose: WorldRect;
  data: AnnotationData;
}

/** How a mark is drawn, as opposed to where. Resolved by the overlay from the
 *  instrument's vocabulary and the mark's own staleness. */
export interface MarkStyle {
  /** The status's color, or the default. */
  color?: string;
  /** A mark whose stored position no longer describes the picture. Drawn
   *  dashed rather than hidden: it still describes *something*, and dropping
   *  it would lose it. */
  stale?: boolean;
}

/** A mark's stored vertices placed in its pose, or the pose's diagonal — a
 *  stored mark whose `shape` did not survive still has to draw somewhere. */
function vertices(m: PaintableMark): { x: number; y: number }[] {
  const stored = m.data.shape;
  if (stored && stored.length >= 2) return fromShape(stored, boxOf(m.pose));
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
 * Pure: a node in, draw commands out, in its target's world. Geometry that a
 * bounding box cannot describe — a line's ends, a stroke's path — comes from
 * `data.shape`, placed in the pose.
 *
 * `scale` is the view's, world to screen. Only a point reads it — its ring is
 * sized in screen pixels — and the default draws that ring as though a world
 * unit were a pixel.
 */
export function markCommands(
  m: PaintableMark,
  style: MarkStyle = {},
  scale: View['scale'] = UNIT_SCALE,
): DrawCommand[] {
  const color = style.color ?? MARK_COLOR;
  const stroke: Stroke = {
    paint: { color },
    width: MARK_WIDTH,
    cap: 'round',
    join: 'round',
    ...(style.stale ? { dash: STALE_DASH } : {}),
  };

  switch (m.data.kind) {
    case 'rect':
      return [
        { kind: 'path', path: rectPath(m.pose.x, m.pose.y, m.pose.width, m.pose.height), stroke },
      ];
    case 'ellipse':
      return [{ kind: 'path', path: ellipsePath(m.pose), stroke }];
    case 'line': {
      const [a, b] = vertices(m);
      return [{ kind: 'path', path: linePath(a, b), stroke }];
    }
    case 'arrow': {
      const [a, b] = vertices(m);
      // The spec's arrow: a line carrying an end marker, not its own geometry.
      return [{ kind: 'path', path: linePath(a, b), stroke: { ...stroke, markerEnd: 'arrow' } }];
    }
    case 'stroke':
      return [{ kind: 'path', path: polyline(vertices(m)), stroke }];
    case 'point': {
      const c = { x: m.pose.x, y: m.pose.y };
      const r = pxExtent(POINT_RADIUS_PX, scale);
      const ring = { x: c.x - r.x, y: c.y - r.y, width: 2 * r.x, height: 2 * r.y };
      // On a `{ px }` stroke the dashes are screen pixels too.
      return [{ kind: 'path', path: ellipsePath(ring), stroke: { ...stroke, width: { px: MARK_WIDTH } } }];
    }
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

/**
 * What picking reads for a point mark: its pose is zero-size, so without this
 * the pointer slop alone decides how close counts, whatever the ring's size.
 * Registered by the overlay, which is the one place marks are picked.
 */
export const POINT_MARK_SHAPE: NodeShapeEntry<AnnotationData, WorldRect> = {
  id: 'labkit:point-mark',
  matches: (node) =>
    node.layer === 'marks' && node.data?.kind === 'point' && typeof node.data.target === 'string',
  // The overlay paints through its own draw callback. This is for a scene
  // drawn without one.
  paint: (node, pose) => markCommands({ pose, data: node.data }),
  silhouette: (_node, pose) => rectPath(pose.x, pose.y, 0, 0),
  // Filled, so a click inside the ring lands on it as it would on a handle.
  ink: () => ({ filled: true, outset: 0, inset: 0, outsetPx: POINT_RADIUS_PX + MARK_WIDTH / 2 }),
};

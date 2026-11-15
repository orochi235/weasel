import type { NodeShapeEntry } from 'canvas/NodeShape';
import type { RectPose } from 'core/scene/types';
import { paintsPose } from './poseBox';
import { SHAPE_PAINTER } from './shapePainter';

// ─── Built-in painters ─────────────────────────────────────────────────
/** Last-resort painter: any rect-posed mark nothing else claimed, drawn as
 *  `kit:shape` draws `shape: 'rect'`, with its `data.fill` and `data.stroke`.
 *  Its whole box stays grabbable, fill or none, and its stroke reaches past it.
 *  The registry keeps it behind every other painter, `'normal'` ones included. */
export const RECT_FALLBACK_PAINTER: NodeShapeEntry<unknown, RectPose> = {
  id: 'kit:rect-fallback',
  matches: (node) => node.kind !== 'group' && paintsPose(node.pose),
  paint: SHAPE_PAINTER.paint,
  silhouette: (_node, p) => ({ kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height }),
  ink: (node, pose, ctx) => {
    const ink = SHAPE_PAINTER.ink!(node, pose, ctx);
    return ink && { ...ink, filled: true };
  },
  bounds: SHAPE_PAINTER.bounds!,
  drawnBounds: SHAPE_PAINTER.drawnBounds!,
};

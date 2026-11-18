import type {
  Path
} from '@weasel-js/geom';
import type { Stroke, Fill, Inherit } from '@weasel-js/paint';
import type { NodeShapeEntry } from 'canvas/NodeShape';
import { nodeMemo } from 'core/scene/nodeMemo';
import type { RectPose } from 'core/scene/types';
import { pathInPoseBox } from '@weasel-js/geom';
import { DERIVED_PAINTER, derivedDrawnBounds } from './derivedPainter';
import { PAINT_SLOT } from './memo';
import { inkReach, inkStroke, pathCommand, pathPaintOf, withAnimatedTrim, withAnimatedVertexColors } from './nodePaint';
import { resolveStroke } from '@weasel-js/paint';
import { paintsPose, poseBoxBounds } from './poseBox';
import { strokedPoseBox } from './strokedBounds';

type PathData = { fill?: Fill | Inherit | null; stroke?: Stroke | Inherit | null; vertexColors?: number[] };

// ─── Built-in painters ─────────────────────────────────────────────────
export const PATH_PAINTER: NodeShapeEntry<unknown, RectPose> = {
  id: 'kit:path',
  matches: (node) => {
    if (!paintsPose(node.pose)) return false;
    const d = node.data as { path?: Path } | null;
    return d?.path != null;
  },
  // Memoized: a pure function of `(data, pose)`, and `pathInPoseBox`
  // allocates on every call but the identity (`kind: 'rect'`) branch. See
  // PAINT_SLOT.
  paint: (node, pose, ctx) => ctx?.derivedPath != null
    // A pose override's path stands in for `data.path`, already where it is drawn.
    ? DERIVED_PAINTER.paint(node, pose, ctx)
    : withAnimatedTrim(withAnimatedVertexColors(nodeMemo(node, PAINT_SLOT, pose, () => {
    const d = node.data as PathData & { path: Path };
    const { fill, stroke } = pathPaintOf(d, ctx?.inherited);
    // The pose is baked into the path rather than emitted as a transform, so a box-relative
    // gradient is baked onto the same box, or it would refer to a frame that never exists.
    return [pathCommand(pathInPoseBox(d.path, pose), fill, stroke, d.vertexColors, pose)];
  }, ctx?.inherited), ctx), ctx),
  silhouette: (node, pose, ctx) => {
    if (ctx?.derivedPath != null) return ctx.derivedPath;
    const d = node.data as { path: Path };
    return pathInPoseBox(d.path, pose);
  },
  ink: (node, _pose, ctx) => {
    const { fill, stroke } = pathPaintOf(node.data as PathData, ctx?.inherited);
    return { filled: fill !== null, ...inkReach(stroke ?? null, ctx?.scale), ...inkStroke(stroke ?? null) };
  },
  // `pathInPoseBox` fits the path's own bounds to the pose box.
  bounds: (node, pose, ctx) =>
    poseBoxBounds(pose, resolveStroke((node.data as PathData).stroke, ctx?.inherited?.stroke), ctx),
  drawnBounds: (node, pose, ctx) => {
    if (ctx?.derivedPath != null) return derivedDrawnBounds(node, ctx);
    const d = node.data as PathData & { path: Path };
    return strokedPoseBox(node, pose, resolveStroke(d.stroke, ctx?.inherited?.stroke), ctx, (at) => pathInPoseBox(d.path, at));
  },
};

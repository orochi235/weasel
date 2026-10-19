import type {
  Path
} from '@weasel-js/geom';
import type { Stroke, Fill } from '@weasel-js/paint';
import type { NodeShapeEntry } from 'canvas/NodeShape';
import { nodeMemo } from 'core/scene/nodeMemo';
import type { RectPose } from 'core/scene/types';
import { pathInPoseFrame } from '@weasel-js/geom';
import { commandFill, commandStroke } from '@weasel-js/renderer';
import type { DrawCommand } from '@weasel-js/renderer';
import { DERIVED_PAINTER, derivedDrawnBounds } from './derivedPainter';
import { PAINT_SLOT } from './memo';
import { inkReach, pathPaintOf, withAnimatedVertexColors, resolveNodeStroke } from './nodePaint';
import { paintsPose, poseBoxBounds } from './poseBox';
import { strokedPoseBox } from './strokedBounds';

// ─── Built-in painters ─────────────────────────────────────────────────
export const PATH_PAINTER: NodeShapeEntry<unknown, RectPose> = {
  id: 'kit:path',
  matches: (node) => {
    if (!paintsPose(node.pose)) return false;
    const d = node.data as { path?: Path } | null;
    return d?.path != null;
  },
  // Memoized: a pure function of `(data, pose)`, and `pathInPoseFrame`
  // allocates on every call but the identity (`kind: 'rect'`) branch. See
  // PAINT_SLOT.
  paint: (node, pose, ctx) => ctx?.derivedPath != null
    // A pose override's path stands in for `data.path`, already where it is drawn.
    ? DERIVED_PAINTER.paint(node, pose, ctx)
    : withAnimatedVertexColors(nodeMemo(node, PAINT_SLOT, pose, () => {
    const d = node.data as {
      path: Path;
      fill?: Fill | null;
      stroke?: Stroke | null;
      vertexColors?: number[];
    };
    const projected = pathInPoseFrame(d.path, pose);
    const { fill: declared, stroke: strokeSpec } = pathPaintOf(d);
    // The pose is baked into `projected` rather than emitted as a transform,
    // so a box-relative gradient has to be baked onto the same box here or
    // it would arrive in the renderer referring to a frame that never exists.
    const fill = declared && commandFill(declared, pose);
    const stroke = strokeSpec && commandStroke(strokeSpec, pose);
    const cmd: DrawCommand = {
      kind: 'path',
      path: projected,
      ...(fill ? { fill } : {}),
      ...(fill && d.vertexColors ? { vertexColors: d.vertexColors } : {}),
      ...(stroke ? { stroke } : {}),
    };
    return [cmd];
  }), ctx),
  silhouette: (node, pose, ctx) => {
    if (ctx?.derivedPath != null) return ctx.derivedPath;
    const d = node.data as { path: Path };
    return pathInPoseFrame(d.path, pose);
  },
  ink: (node, _pose, ctx) => {
    const d = node.data as {
      fill?: Fill | null;
      stroke?: Stroke | null;
    };
    const { fill, stroke } = pathPaintOf(d);
    return { filled: fill !== null, ...inkReach(stroke ?? null, ctx?.scale) };
  },
  // `pathInPoseFrame` fits the path's own bounds to the pose box.
  bounds: (node, pose, ctx) =>
    poseBoxBounds(pose, resolveNodeStroke((node.data as { stroke?: Stroke | null }).stroke), ctx),
  drawnBounds: (node, pose, ctx) => {
    if (ctx?.derivedPath != null) return derivedDrawnBounds(node, ctx);
    const d = node.data as { path: Path; stroke?: Stroke | null };
    return strokedPoseBox(node, pose, resolveNodeStroke(d.stroke), ctx, (at) => pathInPoseFrame(d.path, at));
  },
};

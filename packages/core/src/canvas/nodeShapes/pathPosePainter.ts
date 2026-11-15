import { boundsOfPath, type Path } from '@weasel-js/geom';
import type { Stroke, Fill, Inherit } from '@weasel-js/paint';
import type { NodeShapeEntry } from 'canvas/NodeShape';
import { isPathLike, isRectPose } from 'core/geometry/autoPoseDescriptor';
import { nodeMemo } from 'core/scene/nodeMemo';
import { commandFill, commandStroke, type DrawCommand } from '@weasel-js/renderer';
import { PAINT_SLOT } from './memo';
import { inkReach, inkStroke, pathPaintOf, withAnimatedTrim, withAnimatedVertexColors } from './nodePaint';
import { poseBoxBounds } from './poseBox';
import { strokedBounds } from './strokedBounds';

type PaintData = { fill?: Fill | Inherit | null; stroke?: Stroke | Inherit | null; vertexColors?: number[] };

const paintOf = (node: { data?: unknown }, inherited: Parameters<typeof pathPaintOf>[1]) =>
  pathPaintOf((node.data ?? {}) as PaintData, inherited);

// ─── Built-in painters ─────────────────────────────────────────────────
/** Paints a node whose pose is itself a `Path` — the shape `pathPoseDescriptor`
 *  moves and resizes — in its `data.fill` and `data.stroke`, as `kit:path`
 *  paints `data.path`. Like `kit:rect-fallback` for rect poses, it keeps the
 *  whole outline grabbable, fill or none, and sits behind every other painter,
 *  so a consumer painter for path-posed nodes wins. */
export const PATH_POSE_PAINTER: NodeShapeEntry<unknown, Path> = {
  id: 'kit:path-pose',
  matches: (node) => node.kind !== 'group' && isPathLike(node.pose) && !isRectPose(node.pose),
  paint: (node, pose, ctx) => withAnimatedTrim(withAnimatedVertexColors(nodeMemo(node, PAINT_SLOT, pose, () => {
    const { fill: declared, stroke: strokeSpec } = paintOf(node, ctx?.inherited);
    const box = boundsOfPath(pose);
    const fill = declared && commandFill(declared, box);
    const stroke = strokeSpec && commandStroke(strokeSpec, box);
    const vertexColors = (node.data as PaintData | null)?.vertexColors;
    const cmd: DrawCommand = {
      kind: 'path',
      path: pose,
      ...(fill ? { fill } : {}),
      ...(fill && vertexColors ? { vertexColors } : {}),
      ...(stroke ? { stroke } : {}),
    };
    return [cmd];
  }, ctx?.inherited), ctx), ctx),
  silhouette: (_node, pose) => pose,
  ink: (node, _pose, ctx) => {
    const { stroke } = paintOf(node, ctx?.inherited);
    return { filled: true, ...inkReach(stroke ?? null, ctx?.scale), ...inkStroke(stroke ?? null) };
  },
  bounds: (node, pose, ctx) => poseBoxBounds(boundsOfPath(pose), paintOf(node, ctx?.inherited).stroke ?? null, ctx),
  drawnBounds: (node, pose, ctx) => {
    const stroke = paintOf(node, ctx?.inherited).stroke;
    return stroke ? strokedBounds(pose, stroke, ctx?.scale ?? 1, ctx?.screen) ?? boundsOfPath(pose) : boundsOfPath(pose);
  },
};

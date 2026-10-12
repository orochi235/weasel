import type {
  Path
} from '@weasel-js/geom';
import type { FillStyle, Stroke } from '@weasel-js/paint';
import type { NodeShapeEntry } from 'canvas/NodeShape';
import { nodeMemo } from 'core/scene/nodeMemo';
import type { RectPose } from 'core/scene/types';
import { pathInPoseFrame } from '@weasel-js/geom';
import { commandFill, commandStroke } from '../../features/patterns/commandPaint';
import type { DrawCommand } from '../../renderer';
import { DEFAULT_SHAPE_FILL } from '../../util/paint';
import { PAINT_SLOT } from './memo';
import { inkReach, withAnimatedVertexColors, resolveNodeFill, resolveNodeStroke } from './nodePaint';
import { paintsPose, poseBoxBounds } from './poseBox';

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
  paint: (node, pose, ctx) => withAnimatedVertexColors(nodeMemo(node, PAINT_SLOT, pose, () => {
    const d = node.data as {
      path: Path;
      fill?: FillStyle | null;
      stroke?: Stroke | null;
      vertexColors?: number[];
    };
    const projected = pathInPoseFrame(d.path, pose);
    const strokeSpec = resolveNodeStroke(d.stroke);
    const hasStroke = strokeSpec !== null;
    // An undeclared fill falls back to the default one only if there's no
    // stroke — otherwise the path is stroke-only (e.g. pencil) and a default
    // fill would be wrong.
    const declared = resolveNodeFill(d.fill, hasStroke ? null : DEFAULT_SHAPE_FILL);
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
  silhouette: (node, pose) => {
    const d = node.data as { path: Path };
    return pathInPoseFrame(d.path, pose);
  },
  // Mirrors the fill/stroke decisions `paint` makes above — same reads, same
  // 'none' handling, same "no fill declared and a stroke present means
  // stroke-only" fallback. Kept in step with `paint` by
  // `NodeShape.ink.test.ts`, which asserts the two agree.
  ink: (node, _pose, ctx) => {
    const d = node.data as {
      fill?: FillStyle | null;
      stroke?: Stroke | null;
    };
    const stroke = resolveNodeStroke(d.stroke);
    const hasStroke = stroke !== null;
    return {
      filled: resolveNodeFill(d.fill, hasStroke ? null : DEFAULT_SHAPE_FILL) !== null,
      ...inkReach(stroke, ctx?.scale),
    };
  },
  // `pathInPoseFrame` fits the path's own bounds to the pose box.
  bounds: (node, pose, ctx) =>
    poseBoxBounds(pose, resolveNodeStroke((node.data as { stroke?: Stroke | null }).stroke), ctx),
};

import {
  boundsOfPath
} from '@weasel-js/geom';
import type { FillStyle, Stroke } from '@weasel-js/paint';
import type { NodeShapeEntry } from 'canvas/NodeShape';
import { commandFill, commandStroke } from '@weasel-js/renderer';
import type { DrawCommand } from '@weasel-js/renderer';
import { DEFAULT_SHAPE_FILL } from '../../util/paint';
import { derivesPath } from './memo';
import { inkReach, withAnimatedVertexColors, resolveNodeFill, resolveNodeStroke } from './nodePaint';

/**
 * Built-in painter for nodes whose geometry is computed from other nodes'
 * poses. The path itself arrives on the paint context — see
 * {@link NodePaintCtx.derivedPath}.
 *
 * Fill and stroke resolve as `kit:path`'s do, but against the **derived path's
 * own bounds**, not the pose. `kit:path` projects its path into the pose frame
 * first, so there the two boxes are the same one; here the path is already
 * absolute and the pose is typically a zero-sized placeholder, which would
 * collapse a box-relative gradient onto a point.
 *
 * Not memoized on {@link PAINT_SLOT} on purpose: that key is `(node, pose,
 * data)` and cannot see `ctx.derivedPath`, so it would serve one caller's
 * commands to a caller that passed a different path.
 *
 * Rotation still comes from the pose — `wrapNodeOutput` turns the output about
 * the pose AABB's center, which for a zero-sized pose is its origin.
 */
export const DERIVED_PAINTER: NodeShapeEntry = {
  id: 'kit:derived',
  // `dependsOn` alone is not enough: the two fields are independent optionals,
  // and `kit:add` restores a node with its `dependsOn` intact when its
  // `derivePath` key is missing from the registry. Claiming that node would paint
  // nothing where the authored appearance is what the warning promises.
  matches: derivesPath,
  paint: (node, _pose, ctx) => {
    const path = ctx?.derivedPath;
    if (path == null) return [];
    const box = boundsOfPath(path);
    const d = node.data as { fill?: FillStyle | null; stroke?: Stroke | null; vertexColors?: number[] } | null;
    const strokeSpec = resolveNodeStroke(d?.stroke);
    const declared = resolveNodeFill(d?.fill, strokeSpec === null ? DEFAULT_SHAPE_FILL : null);
    const fill = declared && commandFill(declared, box);
    const stroke = strokeSpec && commandStroke(strokeSpec, box);
    const cmd: DrawCommand = {
      kind: 'path',
      path,
      ...(fill ? { fill } : {}),
      ...(fill && d?.vertexColors ? { vertexColors: d.vertexColors } : {}),
      ...(stroke ? { stroke } : {}),
    };
    return withAnimatedVertexColors([cmd], ctx);
  },
  // The derived path *is* the silhouette, and it is already absolute — the
  // pose is a placeholder, so nothing here can be recovered from it. Without
  // a `ctx` this reports null, which `shapeCoversPoint` reads as "no
  // opinion": picking then falls back to that zero-sized pose.
  silhouette: (_node, _pose, ctx) => ctx?.derivedPath ?? null,
  ink: (node, _pose, ctx) => {
    const d = node.data as { fill?: FillStyle | null; stroke?: Stroke | null } | null;
    const stroke = resolveNodeStroke(d?.stroke);
    return {
      filled: resolveNodeFill(d?.fill, stroke === null ? DEFAULT_SHAPE_FILL : null) !== null,
      ...inkReach(stroke, ctx?.scale),
    };
  },
};

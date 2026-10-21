import { boundsOfPath, type Path } from '@weasel-js/geom';
import type { Stroke, Fill } from '@weasel-js/paint';
import type { NodeInkCtx, NodeShapeEntry } from 'canvas/NodeShape';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import { commandFill, commandStroke } from '@weasel-js/renderer';
import type { DrawCommand } from '@weasel-js/renderer';
import { DEFAULT_SHAPE_FILL } from '../../util/paint';
import { derivedPartsOf, type DerivedPart } from 'core/scene/derivedParts';
import { derivesPath } from './memo';
import { strokedBounds } from './strokedBounds';
import {
  inkReach, withAnimatedVertexColors, resolveNodeFill, resolveNodeStroke, type PaintedFill, type PaintedStroke,
} from './nodePaint';

type PaintData = { fill?: Fill | null; stroke?: Stroke | null; vertexColors?: number[] };

function pathCommand(
  path: Path,
  declared: PaintedFill | null,
  strokeSpec: PaintedStroke | null,
  vertexColors: number[] | undefined,
): DrawCommand {
  const box = boundsOfPath(path);
  const fill = declared && commandFill(declared, box);
  const stroke = strokeSpec && commandStroke(strokeSpec, box);
  return {
    kind: 'path',
    path,
    ...(fill ? { fill } : {}),
    ...(fill && vertexColors ? { vertexColors } : {}),
    ...(stroke ? { stroke } : {}),
  };
}

/** The stroked box of the path on `ctx`, or `null` with no path or no stroke. */
export function derivedDrawnBounds(node: { data?: unknown }, ctx: NodeInkCtx | undefined): Bounds | null {
  const path = ctx?.derivedPath;
  const stroke = resolveNodeStroke((node.data as PaintData | null)?.stroke);
  return path == null || stroke === null ? null : strokedBounds(path, stroke, ctx?.scale ?? 1, ctx?.screen);
}

/** One part's command: its own paint where it names one, else the node's. */
function partCommand(part: DerivedPart, d: PaintData | null): DrawCommand {
  const strokeSpec = resolveNodeStroke(part.stroke === undefined ? d?.stroke : part.stroke);
  const declared = resolveNodeFill(
    part.fill === undefined ? d?.fill : part.fill,
    strokeSpec === null ? DEFAULT_SHAPE_FILL : null,
  );
  return pathCommand(part.path, declared, strokeSpec, undefined);
}

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
 *
 * A path made by `pathFromParts` paints one command per part, each with the
 * part's own fill and stroke where it names them.
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
    const d = node.data as PaintData | null;
    const parts = derivedPartsOf(path);
    if (parts !== undefined) return parts.map((part) => partCommand(part, d));
    const strokeSpec = resolveNodeStroke(d?.stroke);
    const declared = resolveNodeFill(d?.fill, strokeSpec === null ? DEFAULT_SHAPE_FILL : null);
    return withAnimatedVertexColors([pathCommand(path, declared, strokeSpec, d?.vertexColors)], ctx);
  },
  // The derived path *is* the silhouette, and it is already absolute — the
  // pose is a placeholder, so nothing here can be recovered from it. Without
  // a `ctx` this reports null, which `shapeCoversPoint` reads as "no
  // opinion": picking then falls back to that zero-sized pose.
  silhouette: (_node, _pose, ctx) => ctx?.derivedPath ?? null,
  drawnBounds: (node, _pose, ctx) => derivedDrawnBounds(node, ctx),
  ink: (node, _pose, ctx) => {
    const d = node.data as { fill?: Fill | null; stroke?: Stroke | null } | null;
    const stroke = resolveNodeStroke(d?.stroke);
    return {
      filled: resolveNodeFill(d?.fill, stroke === null ? DEFAULT_SHAPE_FILL : null) !== null,
      ...inkReach(stroke, ctx?.scale),
    };
  },
};

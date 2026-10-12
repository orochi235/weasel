import type { FillStyle, Stroke } from '@weasel-js/paint';
import type { NodeInk, NodePaintCtx } from 'canvas/NodeShape';
import { countPathAnchors } from '@weasel-js/geom';
import { markerReach } from '@weasel-js/stroke';
import { resolveStrokeWidth } from '@weasel-js/stroke';
import type { DrawCommand, PathDrawCommand } from '@weasel-js/renderer';
import { paintDrawKindRegistry } from '@weasel-js/renderer';
import { bumpNodeMemoGeneration } from 'core/scene/nodeMemo';
import { DEFAULT_SHAPE_FILL } from '../../util/paint';

// The painters memoize a node's paint and resolve a fill's frame inside the
// memo, so the kind set is ambient state that memo cannot see change.
paintDrawKindRegistry.subscribe(bumpNodeMemoGeneration);

/**
 * What a node's `data.fill` means to the built-in painters.
 *
 * A {@link FillStyle} is used as-is — which is how a gradient or a pattern
 * reaches the renderer without a consumer registering a painter of its own.
 * `null` is an explicit "no fill"; `undefined` takes the painter's fallback.
 * Write one with {@link solid} rather than by hand when all you have is a
 * color.
 */
export function resolveNodeFill(
  fill: FillStyle | null | undefined,
  fallback: FillStyle | null,
): FillStyle | null {
  return fill === undefined ? fallback : fill;
}

/** The stroke a built-in painter should emit, or `null` for "no stroke".
 *  `data.stroke` is a whole {@link Stroke} — width, cap, join, dash, miter
 *  limit and align all reach the renderer. {@link strokeOf} builds one from a
 *  color.
 *
 *  A stroke carrying no `paint` reads as no stroke. `Stroke.paint` is
 *  required by the type, so this is unreachable from well-formed data — but a
 *  document is data, and a stroke assembled a field at a time (a width
 *  written onto a node that had none) arrives here without one. Painting it
 *  threw out of `fillInPoseFrame`, and the throw escapes the painter and
 *  takes the whole frame with it: the page and every other node vanish, and
 *  the canvas stays stale until something unrelated requests a redraw. One
 *  malformed node must not be able to blank the document. */
export function resolveNodeStroke(stroke: Stroke | null | undefined): PaintedStroke | null {
  if (stroke?.paint == null) return null;
  return stroke as PaintedStroke;
}

/** A stroke that paints — what everything downstream of `resolveNodeStroke`
 *  works with. */
export type PaintedStroke = Stroke & { paint: FillStyle };

/** Per-side grab reach for a resolved stroke: world units for what the
 *  renderer builds in world, screen pixels for what it builds on screen — a
 *  `{ px }` width, and each head by its own size's units. */
export function inkReach(
  stroke: Stroke | null,
  scale: number | undefined,
): Pick<NodeInk, 'outset' | 'inset' | 'outsetPx' | 'insetPx'> {
  if (stroke === null) return { outset: 0, inset: 0 };
  // A marker paints past the path's own end, and the kit's rule is that
  // visible chrome is hittable — so the reach has to cover it.
  const heads = markerReach(stroke);
  const sides = (width: number, headReach: number) => {
    switch (stroke.align ?? 'center') {
      case 'inner': return { outset: headReach, inset: width };
      case 'outer': return { outset: width + headReach, inset: 0 };
      default: return { outset: width / 2 + headReach, inset: width / 2 };
    }
  };
  const width = stroke.width ?? 1;
  const world = sides(typeof width === 'object' ? 0 : resolveStrokeWidth(width, scale ?? 1), heads.world);
  if (typeof width !== 'object' && !(heads.px > 0)) return world;
  const px = sides(typeof width === 'object' ? width.px : 0, heads.px);
  return { outset: world.outset, inset: world.inset, outsetPx: px.outset, insetPx: px.inset };
}

/** Apply {@link NodePaintCtx.vertexColors} to a path painter's body — its first
 *  command. Applied outside the paint memo, whose key
 *  cannot see an override: `cmds` comes back as-is when nothing changes, and
 *  otherwise as a copy, since a memoized list is not ours to edit. Colors whose
 *  length does not match the path's anchors are dropped. */
export function withAnimatedVertexColors(cmds: DrawCommand[], ctx: NodePaintCtx | undefined): DrawCommand[] {
  const resolve = ctx?.vertexColors;
  const body = cmds[0];
  if (resolve === undefined || body?.kind !== 'path') return cmds;
  const expected = 4 * countPathAnchors(body.path);
  const fill = body.fill ? resolve('fill', body.vertexColors) : undefined;
  const stroke = body.stroke ? resolve('stroke', body.stroke.vertexColors) : undefined;
  const fillChanged = fill?.length === expected && fill !== body.vertexColors;
  const strokeChanged = stroke?.length === expected && stroke !== body.stroke?.vertexColors;
  if (!fillChanged && !strokeChanged) return cmds;
  const next: PathDrawCommand = {
    ...body,
    ...(fillChanged ? { vertexColors: fill as number[] } : {}),
    ...(strokeChanged ? { stroke: { ...body.stroke!, vertexColors: stroke as number[] } } : {}),
  };
  return [next, ...cmds.slice(1)];
}

/** The paint a path node wears, resolved: what an action that turns ink into
 *  geometry reads from a node and tells a consumer to put on a result. */
export interface PathPaint {
  /** `null` is no fill. */
  fill: FillStyle | null;
  /** Absent for no stroke. */
  stroke?: Stroke;
}

/** {@link PathPaint} of a node that keeps its paint in `data.fill` and
 *  `data.stroke`, as the built-in path painter draws it: a stroke with no
 *  `paint` is none, and an undeclared fill is the default shape fill unless
 *  the node is stroked. */
export function pathPaintOf(data: { fill?: FillStyle | null; stroke?: Stroke | null }): PathPaint {
  const stroke = resolveNodeStroke(data.stroke);
  const fill = resolveNodeFill(data.fill, stroke !== null ? null : DEFAULT_SHAPE_FILL);
  return stroke !== null ? { fill, stroke } : { fill };
}

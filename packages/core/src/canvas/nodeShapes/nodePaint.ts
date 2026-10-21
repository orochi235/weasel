import type { Paint, Stroke, Fill } from '@weasel-js/paint';
import type { NodeInk, NodeInkCtx, NodePaintCtx } from 'canvas/NodeShape';
import { countPathAnchors } from '@weasel-js/geom';
import { markerReach } from '@weasel-js/stroke';
import { resolveStrokeWidth, widestStrokeWidth } from '@weasel-js/stroke';
import type { DrawCommand, PathDrawCommand } from '@weasel-js/renderer';
import { paintDrawKindRegistry } from '@weasel-js/renderer';
import { bumpNodeMemoGeneration } from 'core/scene/nodeMemo';

// The painters memoize a node's paint and resolve a fill's frame inside the
// memo, so the kind set is ambient state that memo cannot see change.
paintDrawKindRegistry.subscribe(bumpNodeMemoGeneration);

/**
 * What a node's `data.fill` means to the built-in painters.
 *
 * Its {@link Paint} is used as-is — which is how a gradient or a pattern
 * reaches the renderer without a consumer registering a painter of its own.
 * An absent fill, `null`, and a fill carrying no `paint` all mean "no fill":
 * a node paints only what it declares. Write the paint with {@link solid}
 * rather than by hand when all you have is a color.
 */
export function resolveNodeFill(fill: Fill | null | undefined): PaintedFill | null {
  return fill?.paint == null ? null : (fill as PaintedFill);
}

/** A fill that paints — what everything downstream of `resolveNodeFill`
 *  works with. */
export type PaintedFill = Fill & { paint: Paint };

/** The stroke a built-in painter should emit, or `null` for "no stroke".
 *  `data.stroke` is a whole {@link Stroke} — width, cap, join, dash, miter
 *  limit, and align all reach the renderer. {@link strokeOf} builds one from a
 *  color.
 *
 *  A stroke carrying no `paint` reads as no stroke. The type requires `paint`,
 *  but a document is data, and a stroke assembled a field at a time arrives
 *  here without one; painting it throws out of the painter and takes the whole
 *  frame with it. */
export function resolveNodeStroke(stroke: Stroke | null | undefined): PaintedStroke | null {
  if (stroke?.paint == null) return null;
  return stroke as PaintedStroke;
}

/** A stroke that paints — what everything downstream of `resolveNodeStroke`
 *  works with. */
export type PaintedStroke = Stroke & { paint: Paint };

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
  // Per-vertex widths are world units even on a `{ px }` stroke.
  const worldWidth = widestStrokeWidth(typeof width === 'object' ? 0 : resolveStrokeWidth(width, scale ?? 1), stroke.vertexWidths);
  const world = sides(worldWidth, heads.world);
  if (typeof width !== 'object' && !(heads.px > 0)) return world;
  const px = sides(typeof width === 'object' ? width.px : 0, heads.px);
  return { outset: world.outset, inset: world.inset, outsetPx: px.outset, insetPx: px.inset };
}

/** How far `stroke` reaches outside its outline on every side, world units at
 *  `scale`: {@link inkReach}'s outset with its screen part resolved. */
export function strokeOutset(stroke: Stroke | null, scale: number): number {
  const r = inkReach(stroke, scale);
  return r.outset + (r.outsetPx ?? 0) / (scale > 0 ? scale : 1);
}

/** {@link strokeOutset} per axis of the frame `ctx.screen` maps from: `x` past
 *  the left and right sides, `y` past the top and bottom. A `{ px }` reach
 *  is a disk on screen, and its extent along each axis of that frame is the
 *  support of the disk pulled back through the map. */
export function strokeOutsetPerAxis(stroke: Stroke | null, ctx: NodeInkCtx | undefined): { x: number; y: number } {
  const scale = ctx?.scale ?? 1;
  const screen = ctx?.screen;
  if (!screen) {
    const r = strokeOutset(stroke, scale);
    return { x: r, y: r };
  }
  const r = inkReach(stroke, scale);
  const px = r.outsetPx ?? 0;
  if (px === 0) return { x: r.outset, y: r.outset };
  const [a, b, c, d] = screen;
  const det = Math.abs(a * d - b * c);
  if (!(det > 0)) return { x: r.outset, y: r.outset };
  return { x: r.outset + (px * Math.hypot(c, d)) / det, y: r.outset + (px * Math.hypot(a, b)) / det };
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
  fill: Fill | null;
  /** Absent for no stroke. */
  stroke?: Stroke;
}

/** {@link PathPaint} of a node that keeps its paint in `data.fill` and
 *  `data.stroke`, as the built-in path painter draws it: a stroke or a fill
 *  with no `paint` is none. */
export function pathPaintOf(data: { fill?: Fill | null; stroke?: Stroke | null }): PathPaint {
  const stroke = resolveNodeStroke(data.stroke);
  const fill = resolveNodeFill(data.fill);
  return stroke !== null ? { fill, stroke } : { fill };
}

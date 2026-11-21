/**
 * The kit's default per-node draw function, kept apart from `SceneCanvas.tsx` so non-React
 * callers (headless rasterization via `renderSceneToPixels`) can use it without importing the
 * React component tree.
 *
 * To teach the kit about a new kind of shape, register a painter (`registerNodeShape`) — do not
 * override `drawOne`. Override `drawOne` only for cross-cutting decoration.
 */
import type { Node } from 'core/scene/types';
import type { View } from 'core/viewport/view';
import type { DrawCommand } from '@weasel-js/renderer';
import { textCommandFromRuns } from '@weasel-js/renderer';
import { findNodeShape, findShapeBounds, type NodePaintCtx } from './NodeShape';
import type { NodeShapes } from './nodeShapeRegistry';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import { overChildren } from './overChildren';
import { INHERIT } from '@weasel-js/paint';
import { boundsOfPath, poseFrameOf } from '@weasel-js/geom';
import { isPathLike } from 'core/geometry/autoPoseDescriptor';
import { pixelScaleCtx } from './pixelScale';
import { groupBoxBounds, paintGroupBox } from './nodeShapes/groupBoxPainter';
import { poseBoxBounds } from './nodeShapes/poseBox';

// `globalThis`, not `window`: a render worker has no window, and sets the density it paints at here.
const ambientDpr = (): number => globalThis.devicePixelRatio || 1;

/** Paint one node the way the kit does by default: dispatch to the first
 *  registered node-shape painter that matches, then draw its `data.label` on
 *  top when it has one and the painter does not draw it itself (`drawsLabel`): on top of a
 *  container's children too. A group paints only its box, from `data.background` and
 *  `data.border` (`GroupBoxData`). Consumers replace or wrap this via `drawOne`. */
export function defaultDrawOne<TData, TLayer extends string, TPose>(
  node: Node<TData, TLayer, TPose>,
  pose: TPose,
  view?: View,
  ctx?: NodePaintCtx,
): DrawCommand[] {
  const painter = painterOf(node, ctx?.shapes);
  // A frame builder that knows the density it paints at fills `pixelScale`; the window's is the fallback.
  const paintCtx = !view || ctx?.pixelScale !== undefined
    ? ctx
    : ctx ? { ...ctx, ...pixelScaleCtx(view, ambientDpr()), ...(ctx.scale !== undefined ? { scale: ctx.scale } : {}) } : pixelScaleCtx(view, ambientDpr());
  const primary = painter ? painter.paint(node, pose, paintCtx) : node.kind === 'group' ? paintGroupBox(node, pose) : [];

  // Label overlay: skipped for text nodes (their content is the label) and a painter that draws its own.
  const text = painter?.drawsLabel ? undefined : overlaidLabelOf(node);
  const p = text ? labelAnchorOf(pose) : null;
  if (text && p !== null) {
    // Copy rather than `push`. A painter's return value is not ours to grow:
    // one that memoizes its command list — which is the point of caching
    // `paint` — would gain another label command on every frame, forever.
    const label = textCommandFromRuns(
      p.x + 6,
      p.y + 14,
      [{ text, fill: { paint: { kind: 'solid', color: 'rgba(0,0,0,0.7)' } } }],
      { fontFamily: 'sans-serif', fontSize: 11 },
    );
    // A container's children would cover a label drawn with the container.
    return [...primary, node.kind === 'group' ? overChildren([label]) : label];
  }

  // Rotation and per-node alpha are applied OUTSIDE this function, by `wrapNodeOutput` in
  // the scene walks and the preview-ghost layer, so that consumer-supplied painters get
  // them too.
  return primary;
}

/** The painter {@link defaultDrawOne} paints `node` with. No painter claims a group: its data's
 *  `fill`, `stroke`, `path` or `shape` are its children's. */
function painterOf(node: Node<unknown, string, unknown>, shapes: NodeShapes | undefined) {
  return node.kind === 'group' ? undefined : findNodeShape(node, shapes);
}

/** The `data.label` the kit lays over a node a painter does not label, or none for a text node. */
function overlaidLabelOf(node: Node<unknown, string, unknown>): string | undefined {
  const data = node.data as { label?: string; text?: string } | null;
  return data?.label && data.text == null ? data.label : undefined;
}

/** Where a label's box starts: the pose's own `x`/`y`, or a `Path` pose's bounds' corner.
 *  `null` for a pose with neither, which gets no label rather than one at NaN. */
function labelAnchorOf(pose: unknown): { x: number; y: number } | null {
  const r = pose as { x?: unknown; y?: unknown } | null;
  if (r && typeof r === 'object' && typeof r.x === 'number' && typeof r.y === 'number') return { x: r.x, y: r.y };
  return isPathLike(pose) ? boundsOfPath(pose) : null;
}

/**
 * The box {@link defaultDrawOne}'s output for `node` fits in — the matched
 * painter's `bounds` — or `null` when it has none, or when the kit's `data.label`
 * overlay adds text nothing bounds cheaply, or an inherited stroke with no
 * `ctx.inherited` to say what it takes. The scene slot's `cull` reads it to
 * skip painting nodes the view cannot see.
 */
export function defaultPaintBounds<TData, TLayer extends string, TPose>(
  node: Node<TData, TLayer, TPose>,
  pose: TPose,
  view: View,
  ctx?: Pick<NodePaintCtx, 'inherited' | 'shapes' | 'derivedPath'>,
): Bounds | null {
  const data = node.data as { stroke?: unknown } | null;
  if (overlaidLabelOf(node) !== undefined && !painterOf(node, ctx?.shapes)?.drawsLabel) return null;
  const inherited = ctx?.inherited;
  if (node.kind === 'group') return groupBoxBounds(node.data, pose, screenScalesOf(view, pose));
  if (data?.stroke === INHERIT && inherited === undefined) return null;
  return findShapeBounds(node, pose, { ...screenScalesOf(view, pose), inherited, shapes: ctx?.shapes, derivedPath: ctx?.derivedPath });
}

/** How the view, after the pose's own frame, scales the frame the painter draws in: the geometric mean of its
 *  stretches, and the least, which a `{ px }` stroke is widest at. A frame that squashes an axis widens a
 *  screen-sized stroke along it as much as zooming out would. */
function screenScalesOf(view: View, pose: unknown): { scale: number; leastScale: number } {
  const sx = view.scale.x, sy = view.scale.y;
  const f = poseFrameOf(pose);
  if (f === null) return { scale: Math.sqrt(Math.abs(sx * sy)), leastScale: Math.min(Math.abs(sx), Math.abs(sy)) };
  const a = sx * f[0], b = sy * f[1], c = sx * f[2], d = sy * f[3];
  const det = Math.abs(a * d - b * c);
  const sum = a * a + b * b + c * c + d * d;
  const most = Math.sqrt((sum + Math.sqrt(Math.max(0, sum * sum - 4 * det * det))) / 2);
  return { scale: Math.sqrt(det), leastScale: most > 0 ? det / most : 0 };
}

/**
 * {@link defaultPaintBounds}, or for a group that paints nothing of its own, its box: a
 * visibility index places such a group there rather than everywhere, since it paints nowhere.
 */
export function defaultReachBounds<TData, TLayer extends string, TPose>(
  node: Node<TData, TLayer, TPose>,
  pose: TPose,
  view: View,
  ctx?: Pick<NodePaintCtx, 'inherited' | 'shapes' | 'derivedPath'>,
): Bounds | null {
  const b = defaultPaintBounds(node, pose, view, ctx);
  if (b !== null || node.kind !== 'group') return b;
  const data = node.data as { label?: string; text?: string } | null;
  return data?.label && data.text == null ? null : poseBoxBounds(pose, null, undefined);
}

/**
 * `defaultPaintBounds` when `drawOne` is `defaultDrawOne`, and nothing
 * otherwise: a painter's box says nothing about what a replacement
 * `drawOne` paints.
 */
export function paintBoundsFor<TData, TLayer extends string, TPose>(
  drawOne: unknown,
): typeof defaultPaintBounds<TData, TLayer, TPose> | undefined {
  return drawOne === defaultDrawOne ? defaultPaintBounds : undefined;
}

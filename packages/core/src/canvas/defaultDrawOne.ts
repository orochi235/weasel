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
import type { Bounds } from 'core/viewport/fitViewToBounds';
import { overChildren } from './overChildren';
import { INHERIT } from '@weasel-js/paint';

function pixelScaleOf(view: View): number {
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  return Math.max(Math.abs(view.scale.x), Math.abs(view.scale.y)) * dpr;
}

// Shared across a frame's nodes, which all arrive with the same view.
let lastView: View | undefined;
let lastViewCtx: NodePaintCtx = {};
function viewOnlyCtx(view: View): NodePaintCtx {
  const pixelScale = pixelScaleOf(view);
  if (view !== lastView || lastViewCtx.pixelScale !== pixelScale) {
    lastView = view;
    lastViewCtx = { pixelScale };
  }
  return lastViewCtx;
}

/** Paint one node the way the kit does by default: dispatch to the first
 *  registered node-shape painter that matches, then draw its `data.label` on
 *  top when it has one: on top of a container's children too. Consumers replace or wrap this via `drawOne`. */
export function defaultDrawOne<TData, TLayer extends string, TPose>(
  node: Node<TData, TLayer, TPose>,
  pose: TPose,
  view?: View,
  ctx?: NodePaintCtx,
): DrawCommand[] {
  const painter = findNodeShape(node);
  const paintCtx = !view || ctx?.pixelScale !== undefined
    ? ctx
    : ctx ? { ...ctx, pixelScale: pixelScaleOf(view) } : viewOnlyCtx(view);
  const primary = painter ? painter.paint(node, pose, paintCtx) : [];

  // Label overlay — skipped for text nodes (their content is the label).
  const data = node.data as { label?: string; text?: string } | null;
  if (data?.label && data.text == null) {
    const p = pose as unknown as { x: number; y: number };
    // Copy rather than `push`. A painter's return value is not ours to grow:
    // one that memoizes its command list — which is the point of caching
    // `paint` — would gain another label command on every frame, forever.
    const label = textCommandFromRuns(
      p.x + 6,
      p.y + 14,
      [{ text: data.label, fill: { paint: { kind: 'solid', color: 'rgba(0,0,0,0.7)' } } }],
      { fontFamily: 'sans-serif', fontSize: 11 },
    );
    // A container's children would cover a label drawn with the container.
    return [...primary, node.kind === 'container' ? overChildren([label]) : label];
  }

  // Rotation and per-node alpha are applied OUTSIDE this function, by `wrapNodeOutput` in
  // the scene walks and the preview-ghost layer, so that consumer-supplied painters get
  // them too.
  return primary;
}

/**
 * The box {@link defaultDrawOne}'s output for `node` fits in — the matched
 * painter's `bounds` — or `null` when it has none, or when a `data.label`
 * overlay adds text nothing bounds cheaply. The scene slot's `cull` reads it
 * to skip painting nodes the view cannot see.
 */
export function defaultPaintBounds<TData, TLayer extends string, TPose>(
  node: Node<TData, TLayer, TPose>,
  pose: TPose,
  view: View,
): Bounds | null {
  const data = node.data as { label?: string; text?: string; stroke?: unknown } | null;
  if (data?.label && data.text == null) return null;
  // No scene here to say what an inherited stroke reaches.
  if (data?.stroke === INHERIT) return null;
  const sx = Math.abs(view.scale.x), sy = Math.abs(view.scale.y);
  return findShapeBounds(node, pose, { scale: Math.sqrt(sx * sy), leastScale: Math.min(sx, sy) });
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

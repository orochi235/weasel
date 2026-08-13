/**
 * `defaultDrawOne` — the kit's default per-node draw function.
 *
 * Extracted from `SceneCanvas.tsx` so non-React callers (headless
 * rasterization via `renderSceneToPixels`) can use it without importing
 * the React component tree.
 *
 * Default scene-slot `drawOne` — dispatches through the shape-painter
 * registry (`./NodeShape`). The kit registers built-in painters for
 * text (`kit:text`), paths (`kit:path`), and a rect-from-pose fallback
 * (`kit:rect-fallback`) at module load, so every shape it ships out of
 * the box (rect, ellipse, polygon, star, line, pen, pencil, text) paints
 * without consumer intervention.
 *
 * To teach the kit about a new kind of shape, register a painter — do
 * not override `drawOne`. See `registerNodeShape` for the API and
 * priority semantics. Override `drawOne` only for cross-cutting
 * decoration (post-process every node, mix in overlays from outside
 * the per-node data, etc.).
 *
 * This function also emits an optional `data.label` overlay (sans-serif
 * 11px, top-left) on every non-text painter's output — a convenience
 * for naming zones in demos. Nodes whose painter is `kit:text` skip the
 * overlay since their content already shows.
 */
import type { Node } from 'core/scene/types';
import type { DrawCommand } from '../renderer';
import { textCommand } from 'features/text/textCommand';
import { findNodeShape, type NodePaintCtx } from './NodeShape';

export function defaultDrawOne<TData, TLayer extends string, TPose>(
  node: Node<TData, TLayer, TPose>,
  pose: TPose,
  ctx?: NodePaintCtx,
): DrawCommand[] {
  const painter = findNodeShape(node);
  const primary = painter ? painter.paint(node, pose, ctx) : [];

  // Label overlay — skipped for text nodes (their content is the label).
  const data = node.data as { label?: string; text?: string } | null;
  if (data?.label && data.text == null) {
    const p = pose as unknown as { x: number; y: number };
    // Copy rather than `push`. A painter's return value is not ours to grow:
    // one that memoizes its command list — which is the point of caching
    // `paint` — would gain another label command on every frame, forever.
    return [...primary, textCommand(
      p.x + 6,
      p.y + 14,
      data.label,
      { fontFamily: 'sans-serif', fontSize: 11, fill: { fill: 'solid', color: 'rgba(0,0,0,0.7)' } },
    )];
  }

  // Rotation and per-node alpha are applied OUTSIDE this function, by
  // `wrapNodeOutput` in the scene walks (`buildSceneLayer`,
  // `buildSceneViewCommands`) and the preview-ghost layer, so that
  // consumer-supplied painters get them too. Doing it here would double-wrap.
  return primary;
}

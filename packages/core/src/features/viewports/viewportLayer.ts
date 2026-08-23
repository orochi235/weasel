import type { DrawCommand, GroupDrawCommand } from '../../renderer';
import { drawOneLayer, type Dims, type RenderLayer } from 'core/layers/render';
import type { View } from 'core/viewport/view';
import { mat3, type Mat3 } from '../../renderer/math/mat3';
import type { ResolvableView } from './viewResolver';

/**
 * @experimental
 *
 * A "viewport node" — a screen-space rectangle on the outer canvas that
 * re-renders one or more `source` layers through an *inner* `View`, then
 * clips them to its rect.
 *
 * Use cases: picture-in-picture, minimap, scrolling container, multi-angle
 * preview. The same source layer can be rendered through multiple viewports
 * (different inner views) without duplicating data — viewports are pure
 * lenses on the source.
 *
 * **Inner view semantics.** The source layers draw as if the inner view
 * filled the screen at world-origin — each is wrapped in `viewToMat3(view)`
 * by the same `drawOneLayer` the outer canvas uses. The viewport then
 * translates the result so that the inner view's origin lands at `bounds.x,
 * bounds.y` and clips to `(bounds.w, bounds.h)`. Caller chooses
 * `innerView.{x,y,scale}` to control which slice of source-world is shown.
 *
 * **Input is re-projected on request, not automatically.** `reproject` maps a
 * screen point into the inner view's world; a consumer that wants a click
 * inside a viewport to mean something calls it from its own handler, or feeds
 * `resolvable` to `createViewResolver` to route a whole pointer stream. The
 * dispatcher is untouched either way, so tools still target the outer view.
 *
 * **Screen-space source layers** (e.g., debug overlays, selection chrome)
 * draw in the viewport's own CSS-pixel space: their coords are relative to
 * the rect's top-left, and they clip to it, rather than to the outer canvas.
 */
export interface CreateViewportLayerOpts<TData> {
  id: string;
  label: string;
  /** Layers re-rendered through `view`. Each receives `(data, view, dims)`
   *  exactly as the outer Canvas would call it. */
  source: RenderLayer<TData>[];
  /** The inner view. Static for now — a future revision will accept
   *  `View | (outer: View, dims: Dims) => View` so derivations like
   *  parallax and node-anchored scroll can compose. */
  view: View;
  /** Where on the outer canvas this viewport is painted, in screen-space
   *  CSS pixels. Recomputed every frame so the rect can track an outer
   *  pose, follow a corner, etc. */
  bounds: (outer: View, dims: Dims) => { x: number; y: number; w: number; h: number };
  /** Optional opaque background painted before the source layers. Useful
   *  to keep the underlying outer canvas from showing through when the
   *  inner view leaves part of the viewport empty. */
  background?: string;
}

/**
 * @experimental
 *
 * A {@link RenderLayer} that also answers where a screen point lands inside
 * its inner view. Returned by {@link createViewportLayer}.
 */
export interface ViewportLayer<TData> extends RenderLayer<TData> {
  /**
   * Map a screen point (CSS px, canvas top-left origin) to a point in the
   * inner view's world space. Returns `null` when the point falls outside
   * the viewport rect; the right and bottom edges are exclusive, so
   * neighbouring viewports never both claim a pixel.
   *
   * Pass the same `outer` view and `dims` the frame was drawn with —
   * `bounds` is a pure function of those, so this reproduces the exact rect
   * that was painted rather than a remembered one.
   *
   * This does not touch the dispatcher: tools still receive outer-view
   * coords, and a consumer that wants a click inside a viewport to mean
   * something calls this from its own handler.
   */
  reproject(outer: View, dims: Dims, screen: { x: number; y: number }): { x: number; y: number } | null;
  /**
   * This viewport as a routing candidate for {@link createViewResolver} —
   * its inner view and the rect it paints into for the given outer frame.
   *
   * Pass the `outer` view and `dims` the frame was drawn with, for the same
   * reason `reproject` wants them: `bounds` is recomputed, not remembered.
   */
  resolvable(outer: View, dims: Dims): ResolvableView;
}

/** Build a layer that renders other layers through a second view, inside a
 *  sub-region of the canvas — a minimap, an inset, a magnifier. Its
 *  `reproject` maps screen points back through the inner view so the region
 *  can be interacted with. */
export function createViewportLayer<TData>(
  opts: CreateViewportLayerOpts<TData>,
): ViewportLayer<TData> {
  const { id, label, source, view, bounds, background } = opts;
  return {
    id,
    label,
    space: 'screen',
    resolvable(outer, dims) {
      const b = bounds(outer, dims);
      return { id, view, rect: b };
    },
    reproject(outer, dims, screen) {
      const b = bounds(outer, dims);
      if (
        screen.x < b.x || screen.x >= b.x + b.w ||
        screen.y < b.y || screen.y >= b.y + b.h
      ) return null;
      // Inverse of what `draw` paints: the source applies the inner view, then
      // the group translates by the rect origin.
      return {
        x: (screen.x - b.x) / view.scale.x + view.x,
        y: (screen.y - b.y) / view.scale.y + view.y,
      };
    },
    draw: (data, outerView, dims): DrawCommand[] => {
      const b = bounds(outerView, dims);
      // Inner content drawn through `view`, then translated so the inner
      // view's screen origin lines up with the viewport top-left.
      const children: DrawCommand[] = [];
      if (background) {
        children.push({
          kind: 'path',
          path: { kind: 'rect', x: 0, y: 0, width: b.w, height: b.h },
          fill: { fill: 'solid', color: background },
        });
      }
      const innerDims = { width: b.w, height: b.h };
      for (const layer of source) {
        for (const c of drawOneLayer(layer, data, view, innerDims)) children.push(c);
      }
      const transform: Mat3 = mat3.translate(mat3.identity(), b.x, b.y);
      const group: GroupDrawCommand = {
        kind: 'group',
        transform,
        clip: { kind: 'rect', x: 0, y: 0, width: b.w, height: b.h },
        children,
      };
      return [group];
    },
  };
}

/**
 * @experimental
 *
 * Find which of `layers` owns a screen point, and where that point lands in
 * its inner world. Pass the layers in paint order; the last one containing
 * the point wins, since that is the one drawn on top.
 */
export function viewportsAt<TData>(
  layers: readonly ViewportLayer<TData>[],
  outer: View,
  dims: Dims,
  screen: { x: number; y: number },
): { layer: ViewportLayer<TData>; point: { x: number; y: number } } | null {
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i]!;
    const point = layer.reproject(outer, dims, screen);
    if (point) return { layer, point };
  }
  return null;
}

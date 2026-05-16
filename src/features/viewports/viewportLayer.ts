import type { DrawCommand, GroupDrawCommand } from '../../renderer';
import type { Dims, RenderLayer } from 'core/layers/render';
import type { View } from 'core/viewport/view';
import { mat3, type Mat3 } from '../../renderer/math/mat3';

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
 * filled the screen at world-origin (their own `viewToMat3(innerView)` runs
 * normally). The viewport then translates the result so that the inner
 * view's origin lands at `bounds.x, bounds.y` and clips to `(bounds.w,
 * bounds.h)`. Caller chooses `innerView.{x,y,scale}` to control which slice
 * of source-world is shown.
 *
 * **Hit-testing is not wired up yet** — pointer events still target the
 * outer view. A follow-up task adds dispatcher-side re-projection so a
 * click inside a viewport translates to inner-world coords.
 *
 * **Screen-space source layers** (e.g., debug overlays, selection chrome)
 * still render to the outer canvas, not into the viewport. To include
 * them, wrap them as world-space layers first.
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

export function createViewportLayer<TData>(
  opts: CreateViewportLayerOpts<TData>,
): RenderLayer<TData> {
  const { id, label, source, view, bounds, background } = opts;
  return {
    id,
    label,
    space: 'screen',
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
      for (const layer of source) {
        for (const c of layer.draw(data, view, { width: b.w, height: b.h })) {
          children.push(c);
        }
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

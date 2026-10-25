import type { DrawCommand, GroupDrawCommand } from '@weasel-js/renderer';
import { drawOneLayer, subscribeToSources, type Dims, type RenderLayer } from 'core/layers/render';
import { backgroundFillCommands } from 'core/layers/backgroundFill';
import { normalizeView, type View } from 'core/viewport/view';
import { mat3, type GlMat3 } from '@weasel-js/geom';
import type { ResolvableView } from './viewResolver';

/**
 * A "viewport node" — a screen-space rectangle on the outer canvas that
 * re-renders one or more `source` layers through an *inner* `View`, then
 * clips them to its rect. The same source layer can be rendered through
 * multiple viewports without duplicating data.
 *
 * **Inner view semantics.** The source layers draw as if the inner view
 * filled the screen at world-origin. The viewport then translates the result
 * so that the inner view's origin lands at `bounds.x, bounds.y` and clips to
 * `(bounds.w, bounds.h)`.
 *
 * **This layer paints; it does not take input.** `<CanvasView>` is built on
 * it and routes the pointer stream through the kit's gesture dispatcher —
 * declare one of those for a viewport that should be clickable. `resolvable`
 * is the seam it uses: feed it to `createViewResolver` to route input to a
 * raw viewport yourself.
 *
 * **Screen-space source layers** (e.g., debug overlays, selection chrome)
 * draw in the viewport's own CSS-pixel space: their coords are relative to
 * the rect's top-left, and they clip to it, rather than to the outer canvas.
 */
export interface CreateViewportLayerOpts<TData, TSource = TData> {
  id: string;
  label: string;
  /** Layers re-rendered through `view`. Each receives `(data, view, dims)`
   *  exactly as the outer Canvas would call it.
   *
   *  Pass a thunk for a stack that is assembled elsewhere — it is read fresh
   *  on every `draw`, the same way a thunked `view` is. */
  source: readonly RenderLayer<TSource>[] | (() => readonly RenderLayer<TSource>[]);
  /**
   * The `data` the source layers receive, derived from what the outer canvas
   * passed down. Omit and they get the outer canvas's own. A viewport showing
   * the same scene through a second camera wants its own per-view helpers
   * here — selection, chrome state and gesture previews.
   */
  data?: (outer: TData) => TSource;
  /**
   * The inner view. Pass a thunk for a camera that moves — it is read fresh
   * on every `draw` and `resolvable`, so the two cannot
   * disagree about where the viewport is looking mid-gesture.
   *
   * The thunk receives the outer view and dims, so a derived camera
   * (parallax, node-anchored scroll) is a function of the one hosting it.
   */
  view: View | ((outer: View, dims: Dims) => View);
  /** Where on the outer canvas this viewport is painted, in screen-space
   *  CSS pixels. Recomputed every frame. */
  bounds: (outer: View, dims: Dims) => { x: number; y: number; w: number; h: number };
  /** The part of the outer canvas the viewport shows through, in the same
   *  space as `bounds` and recomputed with it — the rect of a viewport it is
   *  nested in. Omit to show all of `bounds`. */
  clip?: (outer: View, dims: Dims) => { x: number; y: number; w: number; h: number };
  /** Optional opaque background painted before the source layers. */
  background?: string;
}

/**
 * A {@link RenderLayer} that can also describe itself as a routing target.
 * Returned by {@link createViewportLayer}.
 */
export interface ViewportLayer<TData> extends RenderLayer<TData> {
  /**
   * This viewport as a routing candidate for {@link createViewResolver} —
   * its inner view and the rect it paints into for the given outer frame.
   *
   * Pass the `outer` view and `dims` the frame was drawn with: `bounds` is a
   * pure function of those, so this reproduces the exact rect that was
   * painted rather than a remembered one.
   */
  resolvable(outer: View, dims: Dims): ResolvableView;
}

/** Build a layer that renders other layers through a second view, inside a
 *  sub-region of the canvas — a minimap, an inset, a magnifier. */
export function createViewportLayer<TData, TSource = TData>(
  opts: CreateViewportLayerOpts<TData, TSource>,
): ViewportLayer<TData> {
  const { id, label, source, view, bounds, clip: clipAt, background, data: sourceData } = opts;
  const fixedView = typeof view === 'function' ? null : normalizeView(view);
  const viewAt = (outer: View, dims: Dims): View =>
    fixedView ?? normalizeView((view as (outer: View, dims: Dims) => View)(outer, dims));
  const sourceAt = typeof source === 'function' ? source : () => source;
  return {
    id,
    label,
    space: 'screen',
    subscribe: subscribeToSources(sourceAt),
    resolvable(outer, dims) {
      const rect = bounds(outer, dims);
      return clipAt
        ? { id, view: viewAt(outer, dims), rect, clip: clipAt(outer, dims) }
        : { id, view: viewAt(outer, dims), rect };
    },
    draw: (data, outerView, dims): DrawCommand[] => {
      const b = bounds(outerView, dims);
      // Inner content drawn through `view`, then translated so the inner
      // view's screen origin lines up with the viewport top-left.
      const innerDims = { width: b.w, height: b.h, dpr: dims.dpr };
      const children: DrawCommand[] = background
        ? backgroundFillCommands({ kind: 'solid', color: background }, innerDims)
        : [];
      // The cast holds up because `TSource` defaults to `TData`: without a
      // thunk the two are the same type by construction.
      const innerData = sourceData ? sourceData(data) : (data as unknown as TSource);
      const v = viewAt(outerView, dims);
      for (const layer of sourceAt()) {
        for (const c of drawOneLayer(layer, innerData, v, innerDims)) children.push(c);
      }
      const transform: GlMat3 = mat3.translated(mat3.identity(), b.x, b.y);
      const group: GroupDrawCommand = {
        kind: 'group',
        transform,
        clip: clipAt ? clipWithin(b, clipAt(outerView, dims)) : { kind: 'rect', x: 0, y: 0, width: b.w, height: b.h },
        children,
      };
      return [group];
    },
  };
}

type Rect = { x: number; y: number; w: number; h: number };

/** `clip` cut to `b`, measured from `b`'s top-left. */
function clipWithin(b: Rect, clip: Rect): { kind: 'rect'; x: number; y: number; width: number; height: number } {
  const x0 = Math.max(b.x, clip.x);
  const y0 = Math.max(b.y, clip.y);
  const x1 = Math.min(b.x + b.w, clip.x + clip.w);
  const y1 = Math.min(b.y + b.h, clip.y + clip.h);
  return { kind: 'rect', x: x0 - b.x, y: y0 - b.y, width: Math.max(0, x1 - x0), height: Math.max(0, y1 - y0) };
}

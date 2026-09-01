import type { RenderLayer } from '../../core/layers/render';
import type { View } from '../../core/viewport/view';
import { deriveParallaxView, type ParallaxOpts } from './deriveParallaxView';

/** Options for `createParallaxLayer`. */
export interface CreateParallaxLayerOpts<TData> extends ParallaxOpts {
  id: string;
  label: string;
  /** Layers re-rendered through the derived inner view. */
  source: RenderLayer<TData>[];
  /** Where the camera view comes from. Defaults to the view the Canvas hands
   *  the layer — the `view` prop. A consumer running a 60 Hz camera through
   *  refs pins that prop to identity, and would otherwise get identity back
   *  for every `pan` value and a backdrop that never moves. */
  getOuterView?: () => View;
}

/**
 * Wrap source RenderLayers in a parallax plane. The plane's inner view is
 * derived from the camera view per {@link deriveParallaxView}; source layers
 * run under that inner view and the result is emitted as `space: 'screen'`
 * so the outer Canvas applies no further transform.
 *
 * **Cosmetic only (v1):** pointer events still target the outer view.
 * Objects on parallax planes are paint, not clickable scene nodes. Use the
 * standalone `deriveParallaxView` helper if you need to project pointer
 * positions for a v2 interactive plane.
 *
 * **Screen-space source layers don't compose meaningfully** — they ignore
 * the derived view by definition. Same constraint as `createViewportLayer`.
 */
export function createParallaxLayer<TData>(
  opts: CreateParallaxLayerOpts<TData>,
): RenderLayer<TData> {
  const { id, label, source, pan, zoom, anchor, getOuterView } = opts;
  return {
    id,
    label,
    space: 'screen',
    draw: (data, outer, dims) => {
      const inner = deriveParallaxView(getOuterView?.() ?? outer, { pan, zoom, anchor });
      return source.flatMap((layer) => layer.draw(data, inner, dims));
    },
  };
}

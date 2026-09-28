import { drawOneLayer, subscribeToSources, type RenderLayer } from '../../core/layers/render';
import type { View } from '../../core/viewport/view';
import { deriveParallaxView, type ParallaxOpts } from '../../core/viewport/parallax';
import { isParallaxSource, type ParallaxSource } from './createParallaxPlane';

/** Options for `createParallaxLayer`. */
export interface CreateParallaxLayerOpts<TData> {
  id: string;
  label: string;
  /** Layers re-rendered through the derived inner view. */
  source: RenderLayer<TData>[];
  /** How the plane tracks the camera. Pass a `ParallaxSource` (such as
   *  `createParallaxPlane`) to change it after the layer is built — an
   *  animator tweening `pan` or `zoom` writes the plane, not the layer. */
  parallax: ParallaxOpts | ParallaxSource;
  /** Where the camera view comes from. Defaults to the view the Canvas hands
   *  the layer — the `view` prop. A consumer running a 60 Hz camera through
   *  refs pins that prop to identity, and would otherwise get identity back
   *  for every `pan` value and a backdrop that never moves. */
  getOuterView?: () => View;
}

/**
 * Wrap source RenderLayers in a parallax plane. The plane's inner view is
 * derived from the camera view per {@link deriveParallaxView}; each source
 * layer is drawn through it by `drawOneLayer`, so a `space: 'world'` source
 * gets the inner view's transform and a `space: 'screen'` one does not. The
 * plane itself is emitted as `space: 'screen'` — its children already carry
 * whatever transform they need, and the outer Canvas must add none.
 *
 * What this draws is paint: pointer events target the camera's view. Content
 * that should be clickable belongs on a scene layer carrying `parallax`
 * instead, which `<SceneCanvas>` renders and picks through the same view.
 *
 * **Screen-space source layers don't compose meaningfully** — they ignore
 * the derived view by definition. Same constraint as `createViewportLayer`.
 */
export function createParallaxLayer<TData>(
  opts: CreateParallaxLayerOpts<TData>,
): RenderLayer<TData> {
  const { id, label, source, parallax, getOuterView } = opts;
  const read = isParallaxSource(parallax) ? () => parallax.get() : () => parallax;
  const fromSources = subscribeToSources(source);
  return {
    id,
    label,
    space: 'screen',
    subscribe: isParallaxSource(parallax)
      ? (listener) => {
        const offSources = fromSources(listener);
        const offPlane = parallax.subscribe(listener);
        return () => { offSources(); offPlane(); };
      }
      : fromSources,
    draw: (data, outer, dims) => {
      const inner = deriveParallaxView(getOuterView?.() ?? outer, read());
      return source.flatMap((layer) => drawOneLayer(layer, data, inner, dims));
    },
  };
}

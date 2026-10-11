/**
 * `RenderLayer` wrapper that conditionally emits draw commands based on a
 * predicate. Most common use: hide selection-overlay handles when the
 * canvas isn't focused.
 *
 * The predicate is a getter (`() => boolean`), not a static value, because
 * RenderLayers are constructed once but their `draw` runs every frame —
 * a static value would lock in whatever the predicate returned at
 * construction time.
 *
 * A rule that chrome-caps can express belongs there, since it gates the
 * hit-test as well as the paint. This is for layers outside its vocabulary.
 */
import { subscribeToSources, type RenderLayer } from './render';

/** Options for `gateLayer`. */
export interface GateLayerOptions<TData> {
  /** The wrapped layer. Everything but `draw`, `hitTest`, and `deps` flows
   *  through unchanged. */
  layer: RenderLayer<TData>;
  /** Returns `true` to render the layer this frame, `false` to skip. */
  visible: () => boolean;
}

/** Wrap a render layer so it only draws, and is only hit, while `visible()`
 *  is true. The predicate is consulted per frame, which is how chrome follows
 *  canvas focus without the layer knowing anything about focus. */
export function gateLayer<TData>(opts: GateLayerOptions<TData>): RenderLayer<TData> {
  const { layer, visible } = opts;
  const wrapped: RenderLayer<TData> = {
    ...layer,
    draw: (data, view, dims) => (visible() ? layer.draw(data, view, dims) : []),
  };
  const { deps, hitTest } = layer;
  if (deps) wrapped.deps = (data, view, dims) => [visible(), ...deps(data, view, dims)];
  if (hitTest) wrapped.hitTest = (...args) => (visible() ? hitTest(...args) : null);
  if (layer.subscribe) wrapped.subscribe = subscribeToSources([layer]);
  return wrapped;
}

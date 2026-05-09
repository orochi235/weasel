/**
 * `RenderLayer` wrapper that conditionally emits draw commands based on a
 * predicate. Most common use: hide selection-overlay handles when the
 * canvas isn't focused.
 *
 * The predicate is a getter (`() => boolean`), not a static value, because
 * RenderLayers are constructed once but their `draw` runs every frame —
 * a static value would lock in whatever the predicate returned at
 * construction time.
 */
import type { RenderLayer } from '../../core/layers/render';

export interface GateLayerOptions<TData> {
  /** The wrapped layer. Its `id`, `label`, `defaultVisible`, `alwaysOn`,
   *  `space` flow through unchanged. */
  layer: RenderLayer<TData>;
  /** Returns `true` to render the layer this frame, `false` to skip. */
  visible: () => boolean;
}

export function gateLayer<TData>(opts: GateLayerOptions<TData>): RenderLayer<TData> {
  const { layer, visible } = opts;
  const wrapped: RenderLayer<TData> = {
    id: layer.id,
    label: layer.label,
    draw: (data, view, dims) => (visible() ? layer.draw(data, view, dims) : []),
  };
  if (layer.defaultVisible !== undefined) wrapped.defaultVisible = layer.defaultVisible;
  if (layer.alwaysOn !== undefined) wrapped.alwaysOn = layer.alwaysOn;
  if (layer.space !== undefined) wrapped.space = layer.space;
  return wrapped;
}

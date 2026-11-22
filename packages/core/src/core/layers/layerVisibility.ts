/** Which of a canvas's layers reach the screen, and in what order. */
import type { RenderLayer } from './render';

/**
 * Resolve one layer's visibility: `alwaysOn` wins, then an explicit entry in
 * `visibility`, then `defaultVisible`, defaulting to shown.
 */
export function isLayerVisible<TData>(
  layer: RenderLayer<TData>,
  visibility: Record<string, boolean>,
): boolean {
  if (layer.alwaysOn) return true;
  if (Object.hasOwn(visibility, layer.id)) return visibility[layer.id]!;
  return layer.defaultVisible ?? true;
}

/**
 * Does this layer reach the screen at all — membership of
 * {@link paintedLayers}, asked of one layer.
 *
 * **A listed `order` is the whole list**, so omission from it drops a layer
 * that `visibility` would have shown, and `alwaysOn` does not rescue it.
 * Hit-testing asks this, not `isLayerVisible`.
 */
export function isLayerPainted<TData>(
  layer: RenderLayer<TData>,
  visibility: Record<string, boolean>,
  order: readonly string[] | undefined,
): boolean {
  if (order && !order.includes(layer.id)) return false;
  return isLayerVisible(layer, visibility);
}

/**
 * The layers that reach the screen, in the order they are drawn: `order`
 * sequences them, each at its first place, and drops what it leaves out, then `visibility` drops what is
 * hidden. What `drawLayers` paints, and what a view narrows its stack with.
 */
export function paintedLayers<TData>(
  layers: readonly RenderLayer<TData>[],
  visibility: Record<string, boolean>,
  order: readonly string[] | undefined,
): RenderLayer<TData>[] {
  if (!order) return layers.filter((l) => isLayerVisible(l, visibility));
  const byId = new Map(layers.map((l) => [l.id, l]));
  return [...new Set(order)]
    .map((id) => byId.get(id))
    .filter((l): l is RenderLayer<TData> => l !== undefined && isLayerVisible(l, visibility));
}

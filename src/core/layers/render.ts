import type { View } from '../../features/viewport/view';

const IDENTITY_VIEW: View = { x: 0, y: 0, scale: 1 };

/**
 * A single named render sub-layer within a canvas renderer.
 *
 * @template TData - The data object passed to each draw call.
 */
export interface RenderLayer<TData> {
  /** Unique identifier used in visibility maps and ordering arrays. */
  id: string;
  /** Human-readable name for UI toggles. */
  label: string;
  /** Draw this layer's content onto the canvas. */
  draw: (ctx: CanvasRenderingContext2D, data: TData, view: View) => void;
  /**
   * Whether the layer is shown when no explicit visibility entry exists.
   * Defaults to `true` when absent.
   */
  defaultVisible?: boolean;
  /**
   * When true, the layer is always drawn regardless of the visibility map.
   * Useful for layers that must never be hidden (e.g. base grid).
   */
  alwaysOn?: boolean;
  /**
   * Coordinate space the layer draws in. World-space layers (default) get
   * `setTransform(scale, 0, 0, scale, -view.x*scale, -view.y*scale)` applied
   * before draw. Screen-space layers get identity transform — they're
   * responsible for any world↔screen projection.
   * Default: `'world'`.
   */
  space?: 'world' | 'screen';
}

/**
 * Iterate layers and call `draw` for each visible one.
 *
 * Visibility resolution order:
 *   1. `alwaysOn` — always drawn, ignores visibility map.
 *   2. Explicit entry in `visibility` map — overrides default.
 *   3. `layer.defaultVisible` — falls back to `true` when absent.
 *
 * Viewport: each layer's draw is wrapped in save/restore. World-space
 * layers (default) get a `setTransform(scale, 0, 0, scale, -view.x*scale,
 * -view.y*scale)` so draws can use world coords directly. Screen-space
 * layers get an identity setTransform.
 *
 * When `view` is omitted, an identity view is used.
 */
export function runLayers<TData>(
  ctx: CanvasRenderingContext2D,
  layers: RenderLayer<TData>[],
  data: TData,
  visibility: Record<string, boolean>,
  order?: string[],
  view?: View,
): void {
  const layerById = new Map(layers.map((l) => [l.id, l]));

  const sequence = order
    ? order.map((id) => layerById.get(id)).filter((l): l is RenderLayer<TData> => l !== undefined)
    : layers;

  const v = view ?? IDENTITY_VIEW;

  for (const layer of sequence) {
    const visible =
      layer.alwaysOn ||
      (layer.id in visibility ? visibility[layer.id] : (layer.defaultVisible ?? true));

    if (!visible) continue;

    ctx.save();
    if ((layer.space ?? 'world') === 'world') {
      ctx.setTransform(v.scale, 0, 0, v.scale, -v.x * v.scale || 0, -v.y * v.scale || 0);
    } else {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    layer.draw(ctx, data, v);
    ctx.restore();
  }
}

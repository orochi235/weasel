import type { View } from '../../features/viewport/view';

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
  draw: (ctx: CanvasRenderingContext2D, data: TData) => void;
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
   * Coordinate space the layer draws in. When `runLayers` is called with a
   * `view`, world-space layers (default) are wrapped in a translate so the
   * draw can use world coords directly. Screen-space layers receive only a
   * save/restore — they're responsible for any world↔screen projection.
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
 * Viewport: when `view` is supplied, each layer's draw is wrapped:
 *   - `space: 'world'` (default) → ctx.save(); ctx.translate(-view.x, -view.y); draw(); ctx.restore()
 *   - `space: 'screen'`          → ctx.save();                                    draw(); ctx.restore()
 *
 * When `view` is omitted, draws run unwrapped (legacy behavior).
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

  for (const layer of sequence) {
    const visible =
      layer.alwaysOn ||
      (layer.id in visibility ? visibility[layer.id] : (layer.defaultVisible ?? true));

    if (!visible) continue;

    if (view === undefined) {
      layer.draw(ctx, data);
      continue;
    }

    ctx.save();
    if ((layer.space ?? 'world') === 'world') {
      ctx.translate(-view.x, -view.y);
    }
    layer.draw(ctx, data);
    ctx.restore();
  }
}

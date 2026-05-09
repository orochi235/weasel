import type { DrawCommand } from '@orochi235/weasel-gl';
import type { View } from '../../core/viewport/view';

const IDENTITY_VIEW: View = { x: 0, y: 0, scale: 1 };

/**
 * Canvas size in CSS pixels — passed to `draw` for layers that anchor to
 * canvas edges (e.g. the debug overlay's layer-list panel). The GL backend
 * supplies it explicitly so layers don't have to know about DPR.
 */
export interface Dims {
  width: number;
  height: number;
}

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
  /**
   * Emit a DrawCommand tree for the GL backend to dispatch.
   *
   * For world-space layers (the default), wrap world-space content in a
   * `kind: 'group'` whose `transform` is `viewToMat3(view)` so it maps to
   * screen coords. For screen-space layers (`space: 'screen'`), emit
   * commands in screen-space CSS pixels directly.
   */
  draw: (data: TData, view: View, dims: Dims) => DrawCommand[];
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
   * Coordinate space the layer draws in. World-space layers (default) emit
   * world-space DrawCommands wrapped in a `kind: 'group'` with
   * `viewToMat3(view)`. Screen-space layers emit commands in CSS-pixel
   * coords directly and must call `worldToScreen` for any world-anchored
   * chrome.
   * Default: `'world'`.
   */
  space?: 'world' | 'screen';
}

/**
 * Walk visible layers and concatenate their emitted DrawCommand arrays into
 * one flat list, ready to feed to `WeaselRenderer.render(commands)`.
 *
 * Visibility resolution order:
 *   1. `alwaysOn` — always drawn, ignores visibility map.
 *   2. Explicit entry in `visibility` map — overrides default.
 *   3. `layer.defaultVisible` — falls back to `true` when absent.
 *
 * No transform composition happens here — each layer's `draw` already wraps
 * world-space content in `kind: 'group'` with `viewToMat3(view)`;
 * screen-space layers emit screen-pixel coords directly.
 */
export function drawLayers<TData>(
  layers: RenderLayer<TData>[],
  data: TData,
  visibility: Record<string, boolean>,
  order: string[] | undefined,
  view: View | undefined,
  dims: Dims,
): DrawCommand[] {
  const layerById = new Map(layers.map((l) => [l.id, l]));
  const sequence = order
    ? order.map((id) => layerById.get(id)).filter((l): l is RenderLayer<TData> => l !== undefined)
    : layers;
  const v = view ?? IDENTITY_VIEW;
  const out: DrawCommand[] = [];

  for (const layer of sequence) {
    const visible =
      layer.alwaysOn ||
      (layer.id in visibility ? visibility[layer.id] : (layer.defaultVisible ?? true));
    if (!visible) continue;

    const cmds = layer.draw(data, v, dims);
    for (const c of cmds) out.push(c);
  }

  return out;
}

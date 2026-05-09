import type { DrawCommand } from '@orochi235/weasel-gl';
import type { View } from '../../features/viewport/view';

const IDENTITY_VIEW: View = { x: 0, y: 0, scale: 1 };

/**
 * Canvas size in CSS pixels — passed to `drawGL` for layers that anchor to
 * canvas edges (e.g. the debug overlay's layer-list panel). Today's 2D
 * `draw` reads it via `ctx.canvas.width` (device pixels — DPR-multiplied);
 * the GL backend supplies it explicitly so layers don't have to know about
 * DPR.
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
   * Draw this layer's content onto the canvas. The 2D backend.
   * Stays unchanged through the GL transition; replaced by `drawGL` in the
   * final step.
   */
  draw: (ctx: CanvasRenderingContext2D, data: TData, view: View) => void;
  /**
   * Emit a DrawCommand tree for the GL backend to dispatch. Optional
   * during the GL transition — layers ship `drawGL` incrementally. The 2D
   * dispatcher (`drawLayers`) ignores this field; only the GL dispatcher
   * (lands in a later step) reads it.
   *
   * For world-space layers (the default), wrap world-space content in a
   * `kind: 'group'` whose `transform` is `viewToMat3(view)` so it maps to
   * screen coords. For screen-space layers (`space: 'screen'`), emit
   * commands in screen-space CSS pixels directly, matching the 2D path.
   */
  drawGL?: (data: TData, view: View, dims: Dims) => DrawCommand[];
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
   * `ctx.scale(view.scale, view.scale)` then `ctx.translate(-view.x, -view.y)`
   * composed onto whatever transform is current — so the caller's
   * device-pixel-ratio scaling (set up by `setupCanvasDpr` once per render)
   * is preserved. Screen-space layers get *no* extra transform; they draw
   * directly in CSS-pixel space and must call `worldToScreen` for any
   * world-anchored chrome.
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
 * layers (default) get `ctx.scale(view.scale, view.scale)` then
 * `ctx.translate(-view.x, -view.y)` *composed* onto the existing transform,
 * so the caller's DPR pre-scaling (from `setupCanvasDpr`) is preserved.
 * Screen-space layers get no transform change — they draw in CSS-pixel
 * space and must call `worldToScreen` for any world-anchored chrome.
 *
 * When `view` is omitted, an identity view is used.
 */
export function drawLayers<TData>(
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
      if (v.scale !== 1) ctx.scale(v.scale, v.scale);
      if (v.x !== 0 || v.y !== 0) ctx.translate(-v.x, -v.y);
    }
    // Screen-space layers draw under the caller's current transform (DPR).
    layer.draw(ctx, data, v);
    ctx.restore();
  }
}

const warnedMissingDrawGL = new Set<string>();

/**
 * GL counterpart to {@link drawLayers}. Walks the same visibility/order
 * resolution as the 2D path but invokes each layer's `drawGL?(data, view, dims)`
 * and concatenates the returned DrawCommand arrays into one flat list, ready
 * to feed to `WeaselRenderer.render(commands)`.
 *
 * Layers without a `drawGL` while the GL backend is active emit a one-time
 * `console.warn` keyed by layer id, then contribute zero commands. The 2D
 * `draw` is never called.
 *
 * Unlike `drawLayers`, no transform composition happens here — each layer's
 * `drawGL` already wraps world-space content in `kind: 'group'` with
 * `viewToMat3(view)` (see step 7); screen-space layers emit screen-pixel
 * coords directly.
 */
export function drawLayersGL<TData>(
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

    if (!layer.drawGL) {
      if (!warnedMissingDrawGL.has(layer.id)) {
        warnedMissingDrawGL.add(layer.id);
        console.warn(
          `weasel: layer "${layer.id}" (${layer.label}) has no drawGL implementation; ` +
          `skipping. The GL backend cannot dispatch the 2D draw method.`,
        );
      }
      continue;
    }

    const cmds = layer.drawGL(data, v, dims);
    for (const c of cmds) out.push(c);
  }

  return out;
}

/** @internal — exposed for tests so they can reset the warn-once memo. */
export function _resetDrawLayersGLWarnings(): void {
  warnedMissingDrawGL.clear();
}

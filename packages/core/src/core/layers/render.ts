import { viewToMat3, type DrawCommand } from '../../renderer';
import type { View } from 'core/viewport/view';

const IDENTITY_VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };

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
   * For world-space layers (the default), emit commands in WORLD COORDS —
   * `drawLayers` automatically wraps them in `{ kind: 'group', transform:
   * viewToMat3(view), ... }` before handing them to the renderer. Do NOT
   * apply the view transform yourself.
   *
   * For screen-space layers (`space: 'screen'`), emit commands in CSS-pixel
   * coords directly; `drawLayers` passes them through unchanged. If part
   * of a screen-space layer's output needs to track the view, wrap that
   * subset manually with `viewToMat3(view)`.
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
   * Coordinate space the layer draws in.
   *
   * - `'world'` (default): the layer's `draw` returns world-space commands;
   *   `drawLayers` wraps them in a `kind: 'group'` with `viewToMat3(view)`
   *   automatically.
   * - `'screen'`: the layer's `draw` returns screen-space (CSS-pixel)
   *   commands; `drawLayers` passes them through unchanged. World-anchored
   *   chrome inside a screen-space layer must call `worldToScreen` or wrap
   *   the relevant subset with `viewToMat3(view)` manually.
   */
  space?: 'world' | 'screen';
  /**
   * Optional hit-test for **consumer-attached** layers.
   *
   * Only layers registered through `CanvasExtensionApi.registerLayer` are
   * hit-tested: `hitTestExtras` walks them last-registered-first on
   * pointerdown, and `<SceneCanvas>` folds the result into its `affordanceAt`
   * thunk ahead of the kit's own selection chrome. First non-null result
   * wins; null means "I don't claim this hit, try the next layer."
   *
   * Layers that reach the draw stack some other way — a `Tool.overlay`, an
   * entry in the `layers` map — are painted but never hit-tested, so defining
   * `hitTest` on one has no effect. (The kit's own chrome doesn't need it: it
   * goes through `buildAffordanceAt`.)
   *
   * Coordinates are world-space. The `data` arg is the layer's
   * configured data slot (same as `draw`); `view` and `dims` mirror
   * `draw`'s arguments.
   */
  hitTest?: (
    worldX: number,
    worldY: number,
    data: TData,
    view: View,
    dims: Dims,
    /** Chrome-caps visibility predicate. When supplied, the layer must
     *  not return a hit from any chrome element whose id reports
     *  `false`. Absent → every element is hittable. */
    isVisible?: (id: string) => boolean,
  ) => import('../../affordances/types').LayerHit | null;
  /**
   * Called on every pointermove when no gesture is currently captured.
   * Lets layers (e.g. HUD widgets) track hover state without participating
   * in the drag pipeline. Coords are world-space; the layer is responsible
   * for any further conversion (e.g. world→screen for screen-space layers)
   * and for its own throttling.
   */
  onUncapturedMove?: (
    worldX: number,
    worldY: number,
    evt: PointerEvent,
    view: View,
    dims: Dims,
  ) => void;
  /**
   * Called when the cursor leaves the canvas element. Lets layers clear
   * any hover state they're holding.
   */
  onUncapturedLeave?: () => void;
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
 * Transform composition: world-space layers (the default; `space` unset or
 * `'world'`) have their commands wrapped in a `kind: 'group'` with
 * `viewToMat3(view)` before they reach the renderer. Screen-space layers
 * (`space: 'screen'`) pass through unchanged.
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
    if (cmds.length === 0) continue;

    const space = layer.space ?? 'world';
    if (space === 'world') {
      out.push({ kind: 'group', transform: viewToMat3(v), children: cmds });
    } else {
      for (const c of cmds) out.push(c);
    }
  }

  return out;
}

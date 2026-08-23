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

/** One layer's memoized output, keyed by layer id. Owned by the canvas that
 *  calls `drawLayers`, not by `drawLayers` itself — the function is pure. */
export type LayerCommandCache = Map<
  string,
  { deps: readonly unknown[]; cmds: DrawCommand[] }
>;

/**
 * A single named render sub-layer within a canvas renderer.
 *
 * @template TData - The data object passed to each draw call.
 */
export interface RenderLayer<TData> {
  /** Unique identifier used in visibility maps and ordering arrays. When a
   *  cache is in use, an id must identify the same logical layer across
   *  frames — reusing it for a different layer can serve cross-layer commands. */
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
   * Optional cache key. When present and a `LayerCommandCache` is supplied to
   * `drawLayers`, the layer's previous `DrawCommand[]` is reused as long as
   * every entry is `Object.is`-equal to the previous call's. A layer with no
   * `deps` rebuilds on every frame.
   *
   * **The returned commands must be treated as immutable.** A cached tree is
   * handed to the renderer again on later frames, so mutating a tree you
   * previously returned corrupts the cache silently rather than erroring.
   *
   * **Screen-space layers are not protected against a stale `view`/`dims`
   * the way world-space layers are** (see `space` below) — include them in
   * `deps` if `draw` reads them.
   */
  deps?: (data: TData, view: View, dims: Dims) => readonly unknown[];
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
  cache?: LayerCommandCache,
): DrawCommand[] {
  const layerById = new Map(layers.map((l) => [l.id, l]));
  const sequence = order
    ? order.map((id) => layerById.get(id)).filter((l): l is RenderLayer<TData> => l !== undefined)
    : layers;
  const v = view ?? IDENTITY_VIEW;
  const out: DrawCommand[] = [];

  if (cache) {
    for (const id of [...cache.keys()]) {
      if (!layerById.has(id)) cache.delete(id);
    }
  }

  for (const layer of sequence) {
    const visible =
      layer.alwaysOn ||
      (layer.id in visibility ? visibility[layer.id] : (layer.defaultVisible ?? true));
    if (!visible) continue;

    const cmds = drawOneLayer(layer, data, v, dims, cache);
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

/** Resolve one layer's commands, from cache when its deps are unchanged. */
function drawOneLayer<TData>(
  layer: RenderLayer<TData>,
  data: TData,
  view: View,
  dims: Dims,
  cache: LayerCommandCache | undefined,
): DrawCommand[] {
  if (!cache || !layer.deps) return layer.draw(data, view, dims);

  const deps = layer.deps(data, view, dims);
  const entry = cache.get(layer.id);
  if (entry && sameDeps(entry.deps, deps)) return entry.cmds;

  const cmds = layer.draw(data, view, dims);
  cache.set(layer.id, { deps, cmds });
  return cmds;
}

function sameDeps(a: readonly unknown[], b: readonly unknown[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!Object.is(a[i], b[i])) return false;
  }
  return true;
}

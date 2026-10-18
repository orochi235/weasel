import { viewToMat3, type DrawCommand } from '@weasel-js/renderer';
import type { Effect } from '@weasel-js/renderer';
import type { View } from 'core/viewport/view';
import { groupMembership, wrapGroup, type LayerGroup } from './layerGroup';
import { DEFAULT_LAYER_RETAIN, retainedId, type LayerRetainPolicy } from './retain';
import type { RedrawSource } from './redrawSource';

export type { LayerGroup, LayerRetainPolicy };
export { DEFAULT_LAYER_RETAIN };
export { subscribeToSources, type RedrawSource } from './redrawSource';

const IDENTITY_VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };

/** Canvas size in CSS pixels, so layers don't have to know about DPR. */
export interface Dims {
  width: number;
  height: number;
}

/**
 * What a layer's `draw` threw, and which layer threw it. A throw that escaped
 * the frame loop would take the whole frame with it, every other layer
 * included.
 */
export interface LayerDrawFailure {
  layerId: string;
  error: unknown;
}

/** Default report: name the layer, keep the frame. */
function reportLayerFailure({ layerId, error }: LayerDrawFailure): void {
  console.error(
    `[weasel] layer "${layerId}" threw while drawing; it painted nothing this frame.`,
    error,
  );
}

/** One layer's memoized output, keyed by layer id. Owned by the canvas that
 *  calls `drawLayers`, not by `drawLayers` itself — the function is pure. */
export type LayerCommandCache = Map<
  string,
  {
    deps: readonly unknown[];
    cmds: DrawCommand[];
    /** Whether the last frame served `cmds` from here rather than drawing. */
    reused?: boolean;
    /** The view the last frame drew under. */
    view?: View;
  }
>;

/**
 * One layer of a canvas: `draw` turns `data` and the view into draw commands;
 * the other fields control caching, visibility, coordinate space and hit-testing.
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
   * Emit a DrawCommand tree, in the coordinates `space` names. A world-space
   * layer must NOT apply the view transform itself.
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
  /** Whether the layer is shown when no explicit visibility entry exists.
   *  Defaults to `true` when absent. */
  defaultVisible?: boolean;
  /** When true, the layer is always drawn regardless of the visibility map. */
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
   * Where the layer learns that state `draw` reads, outside the scene and the
   * props, has changed. The canvas painting it subscribes while the layer is
   * mounted and repaints on every notification.
   */
  subscribe?: RedrawSource['subscribe'];
  /**
   * Full-screen passes run over this layer's own pixels before it joins the
   * frame. See `GroupDrawCommand.effects` for what a pass may read, and
   * {@link LayerGroup} to run one chain over several layers at once.
   */
  effects?: readonly Effect[];
  /**
   * Whether the renderer may keep this layer's pixels between frames and
   * composite them as one quad instead of drawing its commands again — see
   * {@link LayerRetainPolicy} for when `drawLayers` does. `false` never
   * retains it, `true` retains it whatever its size; either way only a layer
   * with `deps`, drawn through a cache, and without `effects`.
   */
  retain?: boolean;
  /**
   * Optional hit-test for **consumer-attached** layers.
   *
   * Only layers registered through `CanvasExtensionApi.registerLayer` are
   * hit-tested, last-registered-first, ahead of the kit's own selection
   * chrome. First non-null result wins; null means "I don't claim this hit,
   * try the next layer."
   *
   * Layers that reach the draw stack some other way — a `Tool.overlay`, an
   * entry in the `layers` map — are painted but never hit-tested, so defining
   * `hitTest` on one has no effect.
   *
   * Coordinates are world-space.
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
   * Called on every pointermove when no gesture is currently captured, so a
   * layer can track hover state. Coords are world-space, and the layer does
   * its own throttling.
   */
  onUncapturedMove?: (
    worldX: number,
    worldY: number,
    evt: PointerEvent,
    view: View,
    dims: Dims,
  ) => void;
  /** Called when the cursor leaves the canvas element. */
  onUncapturedLeave?: () => void;
}

/** Where one layer's commands landed in {@link drawLayers}' output,
 *  `[start, end)`, and the CPU milliseconds its `draw` took. A layer group's
 *  run is one span under the group's id. */
export interface LayerDrawSpan {
  id: string;
  start: number;
  end: number;
  buildMs: number;
}

function clockMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

/**
 * Walk visible layers and concatenate their emitted DrawCommand arrays into
 * one flat list, ready to feed to `WeaselRenderer.render(commands)`.
 *
 * A layer whose `draw` throws is dropped for the frame and reported through
 * `onLayerError` — the rest of the frame still paints.
 *
 * `groups` brackets runs of consecutive layers so they composite as one — see
 * `LayerGroup`. `spans`, when passed, receives one {@link LayerDrawSpan} per
 * layer drawn. `retain` decides which unchanged layers the renderer keeps
 * as pixels between frames; `false` keeps none.
 */
export function drawLayers<TData>(
  layers: RenderLayer<TData>[],
  data: TData,
  visibility: Record<string, boolean>,
  order: string[] | undefined,
  view: View | undefined,
  dims: Dims,
  cache?: LayerCommandCache,
  onLayerError: (failure: LayerDrawFailure) => void = reportLayerFailure,
  groups?: readonly LayerGroup[],
  spans?: LayerDrawSpan[],
  retain: LayerRetainPolicy | false = DEFAULT_LAYER_RETAIN,
): DrawCommand[] {
  const layerById = new Map(layers.map((l) => [l.id, l]));
  const v = view ?? IDENTITY_VIEW;
  const out: DrawCommand[] = [];

  if (cache) {
    for (const id of [...cache.keys()]) {
      if (!layerById.has(id)) cache.delete(id);
    }
  }

  const groupOf = groupMembership(groups, layerById.keys());
  const bracketed = new Set<LayerGroup>();
  let run: { group: LayerGroup; children: DrawCommand[]; buildMs: number } | null = null;

  const closeRun = () => {
    if (!run) return;
    const start = out.length;
    const t0 = spans ? clockMs() : 0;
    for (const c of wrapGroup(run.group, run.children, v, dims)) out.push(c);
    spans?.push({ id: run.group.id, start, end: out.length, buildMs: run.buildMs + clockMs() - t0 });
    run = null;
  };

  for (const layer of paintedLayers(layers, visibility, order)) {
    const t0 = spans ? clockMs() : 0;
    const cmds = drawLayerOnce(layer, data, v, dims, cache, onLayerError, retain);
    const buildMs = spans ? clockMs() - t0 : 0;
    // A layer that painted nothing neither joins a run nor breaks one.
    if (cmds.length === 0) {
      spans?.push({ id: layer.id, start: out.length, end: out.length, buildMs });
      continue;
    }

    const group = groupOf?.get(layer.id);
    if (run && run.group !== group) closeRun();
    if (!group) {
      const start = out.length;
      for (const c of cmds) out.push(c);
      spans?.push({ id: layer.id, start, end: out.length, buildMs });
      continue;
    }
    if (!run) {
      if (bracketed.has(group)) {
        console.warn(
          `[weasel] layer group "${group.id}" is not one run — another layer is drawn ` +
          'between its members, so it composites as more than one pass over more than ' +
          'one buffer. Move its members together in the layer order.',
        );
      }
      bracketed.add(group);
      run = { group, children: [], buildMs: 0 };
    }
    run.buildMs += buildMs;
    for (const c of cmds) run.children.push(c);
  }
  closeRun();

  return out;
}

/**
 * Resolve one layer's visibility: `alwaysOn` wins, then an explicit entry in
 * `visibility`, then `defaultVisible`, defaulting to shown.
 */
export function isLayerVisible<TData>(
  layer: RenderLayer<TData>,
  visibility: Record<string, boolean>,
): boolean {
  if (layer.alwaysOn) return true;
  if (layer.id in visibility) return visibility[layer.id]!;
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
 * sequences them and drops what it leaves out, then `visibility` drops what is
 * hidden. What `drawLayers` paints, and what a view narrows its stack with.
 */
export function paintedLayers<TData>(
  layers: readonly RenderLayer<TData>[],
  visibility: Record<string, boolean>,
  order: readonly string[] | undefined,
): RenderLayer<TData>[] {
  if (!order) return layers.filter((l) => isLayerVisible(l, visibility));
  const byId = new Map(layers.map((l) => [l.id, l]));
  return order
    .map((id) => byId.get(id))
    .filter((l): l is RenderLayer<TData> => l !== undefined && isLayerVisible(l, visibility));
}

/**
 * Draw one layer and put its commands in the space its `space` declares:
 * world-space output wrapped in a `viewToMat3(view)` group, screen-space
 * output passed through.
 *
 * Anything rendering layers through a view goes through here.
 *
 * A `draw` that throws yields no commands, and `onLayerError` is told which
 * layer it was. The layer's cache entry goes with it, so the next frame is a
 * real re-attempt.
 */
export function drawOneLayer<TData>(
  layer: RenderLayer<TData>,
  data: TData,
  view: View,
  dims: Dims,
  cache?: LayerCommandCache,
  onLayerError: (failure: LayerDrawFailure) => void = reportLayerFailure,
): DrawCommand[] {
  return drawLayerOnce(layer, data, view, dims, cache, onLayerError, false);
}

function drawLayerOnce<TData>(
  layer: RenderLayer<TData>,
  data: TData,
  view: View,
  dims: Dims,
  cache: LayerCommandCache | undefined,
  onLayerError: (failure: LayerDrawFailure) => void,
  retain: LayerRetainPolicy | false,
): DrawCommand[] {
  let cmds: DrawCommand[];
  try {
    cmds = layerCommands(layer, data, view, dims, cache);
  } catch (error) {
    cache?.delete(layer.id);
    onLayerError({ layerId: layer.id, error });
    return [];
  }
  if (cmds.length === 0) return [];
  const effects = layer.effects && layer.effects.length > 0 ? layer.effects : undefined;
  const kept = retain && !effects && cache ? retainedId(layer, cache, view, retain) : undefined;
  const marked = kept ? { retain: kept } : {};
  if ((layer.space ?? 'world') === 'screen') {
    if (effects) return [{ kind: 'group', effects, children: cmds }];
    return kept ? [{ kind: 'group', ...marked, children: cmds }] : cmds;
  }
  return [{ kind: 'group', transform: viewToMat3(view), ...(effects ? { effects } : {}), ...marked, children: cmds }];
}

/**
 * One layer's own commands, from cache when its deps are unchanged.
 *
 * What is cached is the layer's raw output, before the space wrap above. The
 * wrap is a function of `view`, and a layer whose content does not depend on
 * the camera is entitled to leave `view` out of its deps — caching the wrapped
 * group would then serve a stale transform the moment the camera moved.
 */
function layerCommands<TData>(
  layer: RenderLayer<TData>,
  data: TData,
  view: View,
  dims: Dims,
  cache: LayerCommandCache | undefined,
): DrawCommand[] {
  if (!cache || !layer.deps) return layer.draw(data, view, dims);

  const deps = layer.deps(data, view, dims);
  const entry = cache.get(layer.id);
  if (entry && depsUnchanged(entry.deps, deps)) {
    entry.reused = true;
    return entry.cmds;
  }

  const cmds = layer.draw(data, view, dims);
  cache.set(layer.id, { deps, cmds, reused: false, view: entry?.view });
  return cmds;
}

/** Whether `b` matches `a` entry for entry under `Object.is` — how
 *  `RenderLayer.deps` is compared, and any cache keyed the same way. */
export function depsUnchanged(a: readonly unknown[], b: readonly unknown[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!Object.is(a[i], b[i])) return false;
  }
  return true;
}

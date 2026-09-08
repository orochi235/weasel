import { viewToMat3, type DrawCommand } from '../../renderer';
import type { Effect } from '../../renderer/effects/types';
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
 * What a layer's `draw` threw, and which layer threw it.
 *
 * A `draw` runs on the frame loop, so a throw that escapes it surfaces as an
 * uncaught `requestAnimationFrame` error on the window and takes the whole
 * frame with it — every other layer included. One broken layer painting
 * nothing, named in the console, is the lesser wrong.
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

/**
 * Several consecutive layers composited as one.
 *
 * A layer's own `effects` run over that layer alone, which is the wrong
 * picture whenever a pass reads neighboring pixels: `blur(A over B)` is not
 * `blur(A) over blur(B)`, and it costs a buffer and a pass chain per layer. A
 * group draws its members into one buffer, runs one chain over it, and
 * composites the result back once.
 *
 * Membership is by `RenderLayer.id` — the same names `layerOrder` and
 * `layerVisibility` use, not the `layers` map's slot keys.
 *
 * Only *consecutive* members share a buffer, because anything drawn between
 * two members has to land between them. A group whose members are separated in
 * the render order is drawn as one bracket per run, with a warning: the
 * picture is right, the declaration almost certainly is not.
 *
 * This is a render-stack bracket, not a scene `ContainerNode` — it holds no
 * ids, survives no reload, and nothing in the scene knows about it.
 */
export interface LayerGroup {
  /** Names the group in warnings; not a layer id and never drawn. */
  id: string;
  /** Member layer ids. Order here is ignored — the render order decides. */
  layers: readonly string[];
  /**
   * Passes over the group's combined pixels, in order. A thunk is re-read on
   * every frame, so an animating radius costs no React render; an array is
   * read once per frame either way.
   */
  effects?: readonly Effect[] | ((view: View, dims: Dims) => readonly Effect[]);
  /** Opacity applied to the group's composited result, not to each member. */
  alpha?: number;
  /** 4×5 color matrix (row-major, 20 numbers) applied to the composited
   *  result. See `GroupDrawCommand.colorMatrix`. */
  colorMatrix?: number[];
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
   * Full-screen passes run over this layer's own pixels before it joins the
   * frame — a blur here blurs the world and leaves the HUD drawn above it
   * sharp, which is the thing a CSS `filter` on the `<canvas>` cannot do.
   *
   * Costs nothing while empty: the renderer allocates no offscreen buffer
   * until a layer actually declares one. See `GroupDrawCommand.effects` for
   * what a pass may read, and {@link LayerGroup} to run one chain over
   * several layers at once instead of one chain each.
   */
  effects?: readonly Effect[];
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
 *
 * A layer whose `draw` throws is dropped for the frame and reported through
 * `onLayerError` — the rest of the frame still paints.
 *
 * `groups` brackets runs of consecutive layers so they composite as one — see
 * `LayerGroup`. A layer named by no group is emitted exactly as it was before
 * groups existed, and a frame that declares none allocates nothing.
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

  const groupOf = groupMembership(groups);
  const bracketed = new Set<LayerGroup>();
  let run: { group: LayerGroup; children: DrawCommand[] } | null = null;

  const closeRun = () => {
    if (!run) return;
    for (const c of wrapGroup(run.group, run.children, v, dims)) out.push(c);
    run = null;
  };

  for (const layer of sequence) {
    // `order` is already applied by `sequence`; passing it again would be a
    // second, redundant lookup for the same answer.
    if (!isLayerVisible(layer, visibility)) continue;

    const cmds = drawOneLayer(layer, data, v, dims, cache, onLayerError);
    // A layer that painted nothing neither joins a run nor breaks one. Letting
    // it break one would split a group over a debug overlay that is switched
    // on but currently empty.
    if (cmds.length === 0) continue;

    const group = groupOf?.get(layer.id);
    if (run && run.group !== group) closeRun();
    if (!group) {
      for (const c of cmds) out.push(c);
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
      run = { group, children: [] };
    }
    for (const c of cmds) run.children.push(c);
  }
  closeRun();

  return out;
}

/** Layer id → the group that owns it. First claim wins, so a second one is a
 *  declaration bug rather than a silent reassignment. */
function groupMembership(
  groups: readonly LayerGroup[] | undefined,
): Map<string, LayerGroup> | null {
  if (!groups || groups.length === 0) return null;
  const byLayer = new Map<string, LayerGroup>();
  for (const group of groups) {
    for (const id of group.layers) {
      const claimed = byLayer.get(id);
      if (claimed) {
        console.warn(
          `[weasel] layer "${id}" is claimed by layer groups "${claimed.id}" and ` +
          `"${group.id}"; it stays in "${claimed.id}".`,
        );
        continue;
      }
      byLayer.set(id, group);
    }
  }
  return byLayer;
}

/**
 * Put one run of a group's commands under its shared compositing.
 *
 * No transform: every member already carries its own space wrap, so a second
 * one here would apply the view twice to world layers and once to screen ones.
 * A group that composites plainly gets no wrapper at all — an extra group
 * command that changes nothing is still a push and a pop per frame.
 */
function wrapGroup(
  group: LayerGroup,
  children: DrawCommand[],
  view: View,
  dims: Dims,
): DrawCommand[] {
  const declared = typeof group.effects === 'function'
    ? group.effects(view, dims)
    : group.effects;
  const effects = declared && declared.length > 0 ? declared : undefined;
  if (!effects && group.alpha === undefined && group.colorMatrix === undefined) return children;
  return [{
    kind: 'group',
    ...(effects ? { effects } : {}),
    ...(group.alpha !== undefined ? { alpha: group.alpha } : {}),
    ...(group.colorMatrix !== undefined ? { colorMatrix: group.colorMatrix } : {}),
    children,
  }];
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
 * Does this layer reach the screen at all — both gates, in the order
 * `drawLayers` applies them.
 *
 * **A listed `order` is the whole list**, so omission from it drops a layer
 * that `visibility` would have shown, and `alwaysOn` does not rescue it.
 * Hit-testing asks this, not `isLayerVisible`: a layer that is not painted
 * but still claims pointer events is a pointer landing on nothing the user
 * can see.
 */
export function isLayerPainted<TData>(
  layer: RenderLayer<TData>,
  visibility: Record<string, boolean>,
  order: string[] | undefined,
): boolean {
  if (order && !order.includes(layer.id)) return false;
  return isLayerVisible(layer, visibility);
}

/**
 * Draw one layer and put its commands in the space its `space` declares:
 * world-space output wrapped in a `viewToMat3(view)` group, screen-space
 * output passed through.
 *
 * Anything rendering layers through a view — the canvas itself, a viewport
 * node's inner pass — goes through here. A second copy of this rule that
 * forgets the wrap draws world content at raw world coords, which looks
 * plausible at the identity view and wrong everywhere else.
 *
 * A `draw` that throws yields no commands, and `onLayerError` is told which
 * layer it was. The layer's cache entry goes with it, so the next frame is a
 * real re-attempt rather than a stale tree served under fresh deps.
 */
export function drawOneLayer<TData>(
  layer: RenderLayer<TData>,
  data: TData,
  view: View,
  dims: Dims,
  cache?: LayerCommandCache,
  onLayerError: (failure: LayerDrawFailure) => void = reportLayerFailure,
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
  if ((layer.space ?? 'world') === 'screen') {
    return effects ? [{ kind: 'group', effects, children: cmds }] : cmds;
  }
  return [{ kind: 'group', transform: viewToMat3(view), ...(effects ? { effects } : {}), children: cmds }];
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

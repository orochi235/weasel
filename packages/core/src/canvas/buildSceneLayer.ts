/**
 * The scene slot: an adapter's tree as render layers, one per scene layer.
 */
import { getOwn } from '@weasel-js/registry';
import type { NodeShapes } from './nodeShapeRegistry';
import type { Path } from '@weasel-js/geom';
import type { Dims, LayerDims, RenderLayer } from 'core/layers/render';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import type { View } from 'core/viewport/view';
import { cullDrawCommands, viewToMat3, type DrawCommand } from '@weasel-js/renderer';
import { adapterDerivedPathOf, type DerivingAdapter } from './adapterDerivedPath';
import { composeWorldPose, type PoseAdapter } from 'core/scene/composeFrame';
import { definesFrame } from 'core/scene/effectivePose';
import { buildSceneTree, type HierarchicalAdapter, type SubtreeCullFor } from './buildSceneTree';
import type { Rect } from '@weasel-js/geom';
import { debugSinkFrom } from './drawEnvelope';
import type { NodePaintCtx } from './NodeShape';
import { paintMissesView, type PaintBoundsFn } from './paintCull';
import { pixelScaleCtx } from './pixelScale';
import { sceneLayerKey } from './sceneLayerPaint';
import { wrapNodeOutput } from './wrapNodeOutput';
import { createLodWalk, type LodOptions } from './lod/lodWalk';
import type { LodState } from './lod/lodState';
import type { TileDamage, TileOptions } from 'core/layers/tiles';
import type { TileBox } from '@weasel-js/tiles';

/** Scene slot config — describes how to draw one object with its effective pose. */
export interface SceneSlotConfig<TNode extends { id: string }, TPose> {
  /** Paint these, in this order, in place of the adapter's tree: one flat run with no
   *  scene layers, no container clips, and no pose composition. */
  objects?: TNode[];
  /** The pose an object is painted at. Defaults to `adapter.getPose(obj.id)`. `<SceneCanvas>`
   *  hands it each node as the scene shows it, its `pose` an override's or a derived one,
   *  and carries an override's `path` into the box it answers; return a pose placed from
   *  `obj.pose`, or a drag in flight and a rig's motion do not show in this view. */
  toPose?: (obj: TNode) => TPose;
  /** Draw a single object as a `DrawCommand` tree. `ctx` carries a derived
   *  node's path: `<SceneCanvas>` resolves it from the scene, and
   *  `buildSceneLayer` called without one from its adapter. */
  drawOne: (obj: TNode, pose: TPose, view: View, ctx?: NodePaintCtx) => DrawCommand[];
  /** Where an object is drawn, from its world pose: a scene's quantize rule's
   *  `drawn` half. Painting and its cull read it; picking keeps the pose. */
  drawnPose?: (obj: TNode, pose: TPose) => TPose;
  /** The path a container derives from its dependencies' poses, for the clip
   *  it imposes on its subtree — `drawOne`'s `ctx` carries the derived path a
   *  node *paints*, this one the clip it *imposes*. A scene-aware caller
   *  supplies it; left out, both are resolved off the adapter. */
  derivedPathOf?: (obj: TNode, pose: TPose) => Path | null;
  /** The painters a container's `clip: 'outline'` is read through: the scene's, which
   *  `<SceneCanvas>` fills in. Absent, `defaultNodeShapes`. */
  shapes?: NodeShapes;
  /** Default ghost alpha for the move-overlay slot. Default 0.85. */
  ghostAlpha?: number;
  /** Per-id alpha multiplier. A node's emitted `DrawCommand[]` is wrapped in a
   *  `{ kind: 'group', alpha }` when the returned value is not 1. */
  alphaFor?: (id: string) => number;
  /**
   * Post-processor for the scene slot's emitted commands: called with the final
   * world-space `DrawCommand[]` each time a scene canvas layer draws (after per-node
   * rotation wrapping and `alphaFor`), once per layer when the slot is split into
   * `scene:<layerId>` layers. Its return value replaces the array handed to the renderer.
   *
   * Commands are world-space — `drawLayers` applies the view transform afterward. Clip
   * nesting is capped at 7 levels; a wrapping group with `clip` consumes one. The
   * move-overlay ghost (drag preview) is not post-processed.
   */
  postProcess?: (cmds: DrawCommand[], view: View, dims: Dims) => DrawCommand[];
  /**
   * Skip what cannot reach the view. A node `paintBounds` places outside the
   * `dims` rectangle under `view` is not painted at all; then, after
   * `postProcess`, `cullDrawCommands` drops any remaining command that cannot
   * reach it — see there for what it can and cannot bound. So `postProcess`
   * sees an empty group where a culled node would have painted.
   *
   * Off by default because it makes the layer's world-space output depend on
   * the view: anything that draws this layer once and shows the result under
   * another view — a cache keyed without `view`, a consumer re-wrapping the
   * commands — would show the first view's cull.
   */
  cull?: boolean;
  /**
   * Where `drawOne`'s output for a node can reach, in the frame it paints in
   * — before the pose rotation the slot wraps it in. `null` for a node it
   * cannot bound cheaply. Read only under `cull`, which skips `drawOne` for a
   * node whose box misses the view, so it must enclose everything `drawOne`
   * paints: a box too small makes a node vanish before it leaves the screen.
   *
   * `<SceneCanvas>` supplies `defaultPaintBounds` while `drawOne` is
   * `defaultDrawOne`. Omit it with any other `drawOne` and culling only
   * trims commands after painting.
   */
  paintBounds?: PaintBoundsFn<TNode, TPose>;
  /** Level of detail for the scene's groups: see `LodOptions`. Painters with a `ladder`, and nodes
   *  with a `lod`, switch representations by size on screen whether or not this is set. */
  lod?: LodOptions;
  /** Scene layers kept as tile pyramids, by id: see `TileOptions`. A tiled layer is baked into
   *  tiles at power-of-two scales and drawn from them, its tiles staled by the boxes each edit moves.
   *  A parallax layer draws live. */
  tiles?: Readonly<Record<string, TileOptions>>;
}

/** A scene slot wired to its scene, which can also say which subtrees cannot reach a view
 *  `rect` (screen pixels) by `paintBounds`, for the cull to skip them unwalked. `coarser` lets
 *  boxes taken at a coarser zoom answer, as for a tile bake. */
export interface WiredSceneSlot<TNode extends { id: string }, TPose> extends SceneSlotConfig<TNode, TPose> {
  subtreeCull?: (rect: Rect, opts?: { coarser?: boolean }) => SubtreeCullFor | undefined;
  /** What this view drew each node as last frame, which its picking reads too. Absent, each frame
   *  picks rungs afresh, with no hysteresis. */
  lodState?: LodState;
  /** Where a tiled scene layer's content lies and what each change moved: see `createSceneTileSources`. */
  tileSourceFor?: (layer: string) => { bounds(): TileBox | null; damage: TileDamage };
}

/**
 * `cfg`'s `drawOne` and clip lookup, resolving derived paths off the adapter
 * when nothing scene-aware filled `derivedPathOf` in.
 */
function withAdapterDerivedPaths<TNode extends { id: string }, TPose>(
  cfg: SceneSlotConfig<TNode, TPose>,
  adapter: HierarchicalAdapter<TNode, TPose> | undefined,
  toPose: (obj: TNode) => TPose,
): Pick<SceneSlotConfig<TNode, TPose>, 'drawOne' | 'derivedPathOf'> {
  const drawOne = cfg.drawOne;
  if (cfg.derivedPathOf !== undefined || !drawOne || !adapter) return cfg;
  const pathOf = adapterDerivedPathOf<TPose>(cfg.toPose === undefined ? adapter : toPoseReads(adapter, toPose));
  return {
    derivedPathOf: (obj) => pathOf(obj.id),
    drawOne: (obj, pose, view, ctx) => ((obj as { dependsOn?: unknown }).dependsOn === undefined
      ? drawOne(obj, pose, view, ctx)
      : drawOne(obj, pose, view, { ...ctx, derivedPath: pathOf(obj.id) })),
  };
}

/** What deriving reads of `adapter` when `toPose` says where each node is: the local pose, which a
 *  composing adapter folds up the parent chain as the walk does, so a dependency is read where it is drawn. */
function toPoseReads<TNode extends { id: string }, TPose>(
  adapter: HierarchicalAdapter<TNode, TPose> & { getParent?(id: string): string | null },
  toPose: (obj: TNode) => TPose,
): DerivingAdapter<TPose> {
  const getPose = (id: string): TPose => {
    const obj = adapter.getNode(id);
    return obj ? toPose(obj) : adapter.getPose(id);
  };
  const reads = { getNode: (id: string) => adapter.getNode(id), getPose, getChildren: (id: string | null) => adapter.getChildren(id) };
  const compose = adapter.composePose?.bind(adapter);
  if (compose === undefined) return reads;
  const frames: PoseAdapter<TPose> = {
    getPose,
    getParent: (id) => adapter.getParent?.(id)
      ?? (adapter.getNode(id) as { parent?: string | null } | undefined)?.parent ?? null,
    definesFrame: (id) => {
      const obj = adapter.getNode(id);
      return obj === undefined || definesFrame(obj as never);
    },
    ...(adapter.childFrame ? { childFrame: adapter.childFrame.bind(adapter) } : {}),
  };
  return { ...reads, getWorldPose: (id) => composeWorldPose(frames, id, compose) };
}

/**
 * Build the scene layer, which draws committed poses. `hideIds()` skips the committed paint
 * of ids the active tool is currently ghosting so the source doesn't show through. With a
 * debug sink on its draw envelope, it records each node's bounds and origin there.
 */
export function buildSceneLayer<TNode extends { id: string }, TPose>(
  cfg: WiredSceneSlot<TNode, TPose>,
  adapter: HierarchicalAdapter<TNode, TPose> | undefined,
  boundsOfFn: ((id: string) => Bounds | null) | undefined,
  hideIds: () => Set<string> | null,
  /** When set, the returned layer carries this `id` and paints ONLY the named
   *  scene layer (the rest are walked for ancestor clips). Omit for the single
   *  bundled `scene` layer. */
  slot?: { id: string; forLayer: string },
): RenderLayer<unknown> {
  const toPose =
    cfg.toPose ??
    ((obj: TNode) => (adapter ? adapter.getPose(obj.id) : (obj as unknown as TPose)));
  const { drawOne, derivedPathOf } = withAdapterDerivedPaths(cfg, adapter, toPose);
  const postProcess = cfg.postProcess;
  const drawnAt = cfg.drawnPose ?? ((_obj: TNode, pose: TPose) => pose);
  // A tile bake is culled to its tile whatever the slot says: a tile shows a small part of the scene.
  const culls = (dims: LayerDims) => cfg.cull === true || dims.bake === true;
  const finish = (cmds: DrawCommand[], view: View, dims: LayerDims): DrawCommand[] => (culls(dims)
    ? cullDrawCommands(cmds, viewToMat3(view), { x: 0, y: 0, width: dims.width, height: dims.height }, dims.dpr)
    : cmds);
  const paintBoundsIn = (dims: LayerDims) => (culls(dims) ? cfg.paintBounds : undefined);
  const culledIn = (view: View, dims: LayerDims) => {
    const paintBounds = paintBoundsIn(dims);
    return paintBounds ? paintMissesView(paintBounds, view, { x: 0, y: 0, width: dims.width, height: dims.height }) : undefined;
  };
  const prunedIn = (dims: LayerDims) => paintBoundsIn(dims) && cfg.subtreeCull
    ? cfg.subtreeCull({ x: 0, y: 0, width: dims.width, height: dims.height }, dims.bake ? { coarser: true } : undefined)
    : undefined;
  return {
    id: slot?.id ?? 'scene',
    label: slot ? `Scene: ${slot.forLayer}` : 'Scene',
    draw: (data, view, dims) => {
      const debugSink = debugSinkFrom(data);
      const hidden = hideIds();
      const a = adapter;
      if (a && cfg.objects === undefined && drawOne) {
        const filteredDrawOne = (obj: TNode, pose: TPose, v: View, rung?: string): DrawCommand[] => {
          if (hidden && hidden.has(obj.id)) return [];
          const ctx = pixelScaleCtx(v, dims.dpr);
          const cmds = drawOne(obj, pose, v, rung === undefined ? ctx : { ...ctx, rung });
          if (debugSink) {
            const b = boundsOfFn ? boundsOfFn(obj.id) : null;
            if (b) debugSink.recordBounds(obj.id, b);
            const ox = (pose as { x?: number }).x ?? (b ? b.x : 0);
            const oy = (pose as { y?: number }).y ?? (b ? b.y : 0);
            debugSink.recordOrigin(obj.id, { x: ox, y: oy });
          }
          return wrapNodeOutput(cmds, pose, cfg.alphaFor ? cfg.alphaFor(obj.id) : 1);
        };
        // Honor cfg.toPose on the hierarchical path by shimming getPose on the
        // adapter so buildSceneTree routes through it instead of the raw adapter.
        const hierarchicalAdapter = cfg.toPose
          ? {
              ...a,
              getPose: (id: string) => {
                const obj = a.getNode(id);
                return obj ? toPose(obj) : a.getPose(id);
              },
            }
          : a;
        // World-space commands; drawLayers wraps in viewToMat3 automatically.
        const tree = buildSceneTree(
          hierarchicalAdapter as unknown as Parameters<typeof buildSceneTree>[0],
          filteredDrawOne as unknown as Parameters<typeof buildSceneTree>[1],
          view,
          slot?.forLayer,
          derivedPathOf as Parameters<typeof buildSceneTree>[4],
          culledIn(view, dims) as Parameters<typeof buildSceneTree>[5],
          cfg.drawnPose as Parameters<typeof buildSceneTree>[6],
          view,
          cfg.shapes,
          prunedIn(dims),
          createLodWalk({
            shapes: cfg.shapes, dpr: dims.dpr, options: cfg.lod,
            // A tile bake is no frame of this view's: it picks rungs afresh and records none.
            ...(cfg.lodState && !dims.bake ? { state: cfg.lodState, key: slot?.forLayer ?? 'scene' } : {}),
          }) as Parameters<typeof buildSceneTree>[10],
        );
        return finish(postProcess ? postProcess(tree, view, dims) : tree, view, dims);
      }
      // `cfg.objects`: the caller's own list, which has no scene layers to split by.
      const objects = cfg.objects ?? [];
      const children: DrawCommand[] = [];
      const culled = culledIn(view, dims);
      for (const obj of objects) {
        if (hidden && hidden.has(obj.id)) continue;
        const pose: TPose = toPose(obj);
        const at = drawnAt(obj, pose);
        if (drawOne && !culled?.(obj, at)) {
          const wrapped = wrapNodeOutput(drawOne(obj, at, view, pixelScaleCtx(view, dims.dpr)), at, cfg.alphaFor ? cfg.alphaFor(obj.id) : 1);
          for (const cmd of wrapped) children.push(cmd);
        }
        if (debugSink) {
          const b = boundsOfFn ? boundsOfFn(obj.id) : null;
          if (b) debugSink.recordBounds(obj.id, { x: b.x, y: b.y, width: b.width, height: b.height });
          const ox = (pose as { x?: number }).x ?? (b ? b.x : 0);
          const oy = (pose as { y?: number }).y ?? (b ? b.y : 0);
          debugSink.recordOrigin(obj.id, { x: ox, y: oy });
        }
      }
      // World-space commands; drawLayers wraps in viewToMat3 automatically.
      return finish(postProcess ? postProcess(children, view, dims) : children, view, dims);
    },
  };
}

/**
 * The scene slot as one canvas layer **per scene layer** — keyed `scene:<layerId>` — so
 * consumers can interleave custom layers *between* scene layers via the standard slot
 * anchoring (`before: 'scene:plantings'`). A single `scene` layer when `cfg.objects` replaces
 * the tree, or the adapter declares no layers.
 */
export function buildSceneLayers<TNode extends { id: string }, TPose>(
  cfg: WiredSceneSlot<TNode, TPose>,
  adapter: HierarchicalAdapter<TNode, TPose> | undefined,
  boundsOfFn: ((id: string) => Bounds | null) | undefined,
  hideIds: () => Set<string> | null,
): Array<{ key: string; layer: RenderLayer<unknown> }> {
  const sceneLayerIds =
    cfg.objects === undefined && adapter ? adapter.getLayers().map((l) => l.id) : null;
  if (!sceneLayerIds || sceneLayerIds.length === 0) {
    return [{ key: 'scene', layer: buildSceneLayer(cfg, adapter, boundsOfFn, hideIds) }];
  }
  const parallax = new Set(adapter!.getLayers().filter((l) => l.parallax).map((l) => l.id));
  return sceneLayerIds.map((id) => {
    const layer = buildSceneLayer(cfg, adapter, boundsOfFn, hideIds, { id: sceneLayerKey(id), forLayer: id });
    const opts = getOwn(cfg.tiles, id);
    // A plane moves against the camera's world, which tiles are kept in.
    if (opts && !parallax.has(id)) {
      const source = cfg.tileSourceFor?.(id);
      layer.tiles = {
        ...opts,
        ...(opts.bounds ?? source ? { bounds: opts.bounds ?? source!.bounds } : {}),
        ...(opts.damage ?? source ? { damage: opts.damage ?? source!.damage } : {}),
      };
    }
    return { key: sceneLayerKey(id), layer };
  });
}

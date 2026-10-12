/**
 * The scene slot: how `<Canvas>` turns an adapter's nodes into render layers.
 * One layer for a flat adapter, one per scene layer for a hierarchical one.
 */
import type { Path } from '@weasel-js/geom';
import type { MoveAdapter, ResizeAdapter, RotateAdapter } from 'core/adapters/types';
import type { Dims, RenderLayer } from 'core/layers/render';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import type { View } from 'core/viewport/view';
import type { DebugSink } from '../debug/types';
import { cullDrawCommands, viewToMat3, type DrawCommand } from '@weasel-js/renderer';
import { buildSceneTree, type HierarchicalAdapter } from './buildSceneTree';
import type { NodePaintCtx } from './NodeShape';
import { paintMissesView, type PaintBoundsFn } from './paintCull';
import { sceneLayerKey } from './sceneLayerPaint';
import { wrapNodeOutput } from './wrapNodeOutput';

/**
 * The scene-tree reading methods Canvas feature-detects at draw time, as an
 * *optional* mixin. A `SceneCanvasAdapter` supplies them; flat / bare-Canvas
 * adapters don't. `getPose` already lives on the base move adapter, so only the
 * three tree-walk methods are added here.
 */
type OptionalSceneHierarchy<TNode, TPose> = Partial<
  Pick<HierarchicalAdapter<TNode, TPose>, 'getLayers' | 'getNode' | 'getChildren'>
>;

/** The full adapter shape Canvas threads through layers + gesture hooks: the
 *  move/resize/rotate intersection plus the optional scene-tree methods. */
export type CanvasAdapter<TNode extends { id: string }, TPose> = MoveAdapter<TNode, TPose> &
  ResizeAdapter<TNode, TPose> &
  RotateAdapter<TNode, TPose> &
  OptionalSceneHierarchy<TNode, TPose>;

/** Scene slot config — describes how to draw one object with its effective pose. */
export interface SceneSlotConfig<TNode extends { id: string }, TPose> {
  /** Override `adapter.getNodes()` for the object iteration. */
  objects?: TNode[];
  /** Project an object to its committed pose. Defaults to `adapter.getPose(obj.id)`. */
  toPose?: (obj: TNode) => TPose;
  /** Draw a single object as a `DrawCommand` tree. `ctx` carries what only a
   *  scene-aware caller can supply (a node's derived path); `<SceneCanvas>`
   *  fills it in, bare `<Canvas>` never does. */
  drawOne: (obj: TNode, pose: TPose, view: View, ctx?: NodePaintCtx) => DrawCommand[];
  /** The path a container derives from its dependencies' poses, for the clip
   *  it imposes on its subtree. The other half of what only a scene-aware
   *  caller can supply — `drawOne`'s `ctx` carries the derived path a node
   *  *paints*, this one the clip it *imposes*. */
  derivedPathOf?: (obj: TNode, pose: TPose) => Path | null;
  /** Default ghost alpha for the move-overlay slot. Default 0.85. */
  ghostAlpha?: number;
  /**
   * Optional per-id alpha multiplier. When supplied, each node's emitted
   * `DrawCommand[]` is wrapped in a `{ kind: 'group', alpha }` when the
   * returned value is not 1. The scoping-dim integration supplies this to
   * dim non-active nodes during a mode transition.
   *
   * Defaults to `() => 1` (no effect).
   */
  alphaFor?: (id: string) => number;
  /**
   * Optional post-processor for the scene slot's emitted commands. Called
   * with the final world-space `DrawCommand[]` each time a scene canvas
   * layer draws (after per-node rotation wrapping and `alphaFor`); the
   * return value replaces the array handed to the renderer. When the scene
   * slot is split into per-scene-layer canvas layers (`scene:<layerId>`),
   * it runs once per layer. Identity by default.
   *
   * Commands are world-space — `drawLayers` applies the view transform
   * afterward, so e.g. a `clip` path in a wrapping group is authored in
   * world coordinates. Note clip nesting is capped at 7 levels; a wrapping
   * group with `clip` consumes one.
   *
   * The move-overlay ghost (drag preview) is not post-processed.
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
}

/**
 * Build the scene layer. Tool ghosts (in-flight drag/resize/rotate poses) are
 * published via the active tool's `previewPose`/`previewIds` and rendered on
 * top of this layer (see SceneCanvas's preview-ghost layer); we draw committed
 * poses here, and `hideIds()` lets us skip the committed paint of ids the
 * active tool is currently ghosting so the source doesn't show through.
 */
export function buildSceneLayer<TNode extends { id: string }, TPose>(
  cfg: SceneSlotConfig<TNode, TPose>,
  adapter: CanvasAdapter<TNode, TPose> | undefined,
  debugSink: DebugSink | null,
  boundsOfFn: ((id: string) => Bounds | null) | undefined,
  hideIds: () => Set<string> | null,
  /** When set, the returned layer carries this `id` and paints ONLY the named
   *  scene layer (the rest are walked for ancestor clips). Used to split the
   *  scene slot into per-scene-layer, individually-orderable canvas layers
   *  (`scene:<layerId>`) so consumers can interleave custom layers between
   *  them. Omit for the single bundled `scene` layer. */
  slot?: { id: string; forLayer: string },
): RenderLayer<unknown> {
  const toPose =
    cfg.toPose ??
    ((obj: TNode) => (adapter ? adapter.getPose(obj.id) : (obj as unknown as TPose)));
  const drawOne = cfg.drawOne;
  const postProcess = cfg.postProcess;
  const finish = cfg.cull
    ? (cmds: DrawCommand[], view: View, dims: Dims): DrawCommand[] =>
      cullDrawCommands(cmds, viewToMat3(view), { x: 0, y: 0, width: dims.width, height: dims.height })
    : (cmds: DrawCommand[]): DrawCommand[] => cmds;
  const paintBounds = cfg.cull ? cfg.paintBounds : undefined;
  const culledIn = (view: View, dims: Dims) => paintBounds
    ? paintMissesView(paintBounds, view, { x: 0, y: 0, width: dims.width, height: dims.height })
    : undefined;
  return {
    id: slot?.id ?? 'scene',
    label: slot ? `Scene: ${slot.forLayer}` : 'Scene',
    draw: (_data, view, dims) => {
      const hidden = hideIds();
      const a = adapter;
      if (
        a &&
        cfg.objects === undefined &&
        typeof a.getLayers === 'function' &&
        typeof a.getNode === 'function' &&
        typeof a.getChildren === 'function' &&
        drawOne
      ) {
        const filteredDrawOne = (obj: TNode, pose: TPose, v: View): DrawCommand[] => {
          if (hidden && hidden.has(obj.id)) return [];
          const cmds = drawOne(obj, pose, v);
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
                const obj = a.getNode!(id);
                return obj ? toPose(obj) : a.getPose(id);
              },
            }
          : a;
        // World-space commands; drawLayers wraps in viewToMat3 automatically.
        const tree = buildSceneTree(
          hierarchicalAdapter as Parameters<typeof buildSceneTree>[0],
          filteredDrawOne as unknown as Parameters<typeof buildSceneTree>[1],
          view,
          slot?.forLayer,
          cfg.derivedPathOf as Parameters<typeof buildSceneTree>[4],
          culledIn(view, dims) as Parameters<typeof buildSceneTree>[5],
        );
        return finish(postProcess ? postProcess(tree, view, dims) : tree, view, dims);
      }
      // Flat fallback — keep existing body verbatim. (Per-layer slotting only
      // applies on the hierarchical path; a flat adapter has no scene layers,
      // so the `scene:<layer>` split is a no-op and we emit the whole scene.)
      const objects = cfg.objects ?? adapter?.getNodes() ?? [];
      const children: DrawCommand[] = [];
      const culled = culledIn(view, dims);
      for (const obj of objects) {
        if (hidden && hidden.has(obj.id)) continue;
        const pose: TPose = toPose(obj);
        if (drawOne && !culled?.(obj, pose)) {
          const cmds = drawOne(obj, pose, view);
          const wrapped = wrapNodeOutput(cmds, pose, cfg.alphaFor ? cfg.alphaFor(obj.id) : 1);
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
 * Build the scene slot as one canvas layer **per scene layer** — keyed
 * `scene:<layerId>` — when the adapter is hierarchical (exposes `getLayers`).
 * This lets consumers interleave custom layers *between* scene layers via the
 * standard slot anchoring (`before: 'scene:plantings'`). Each per-layer canvas
 * layer re-runs the scene walk for its own layer only (others are still walked
 * for ancestor clips). Falls back to a single `scene` layer for flat adapters
 * or adapters with no declared layers.
 */
export function buildSceneLayers<TNode extends { id: string }, TPose>(
  cfg: SceneSlotConfig<TNode, TPose>,
  adapter: CanvasAdapter<TNode, TPose> | undefined,
  debugSink: DebugSink | null,
  boundsOfFn: ((id: string) => Bounds | null) | undefined,
  hideIds: () => Set<string> | null,
): Array<{ key: string; layer: RenderLayer<unknown> }> {
  const sceneLayerIds =
    cfg.objects === undefined && typeof adapter?.getLayers === 'function'
      ? adapter.getLayers().map((l) => l.id)
      : null;
  if (!sceneLayerIds || sceneLayerIds.length === 0) {
    return [{ key: 'scene', layer: buildSceneLayer(cfg, adapter, debugSink, boundsOfFn, hideIds) }];
  }
  return sceneLayerIds.map((id) => ({
    key: sceneLayerKey(id),
    layer: buildSceneLayer(cfg, adapter, debugSink, boundsOfFn, hideIds, {
      id: sceneLayerKey(id),
      forLayer: id,
    }),
  }));
}

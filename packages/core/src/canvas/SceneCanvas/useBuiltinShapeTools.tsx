/**
 * Shape-tool synthesis for `<SceneCanvas>` — calls the kit's per-shape tool
 * hooks with default `create` callbacks that produce leaf nodes shaped for
 * the kit's PATH_PAINTER (`data: { path, fill }`). Lets consumers opt into
 * a complete drawing toolset via `<SceneCanvas toolBundle="standard">`
 * without writing per-tool factory code.
 *
 * All hooks are always called (React rules of hooks) — `<SceneCanvas>` only
 * registers the ones requested via `toolBundle` / `defaultTools`.
 */
import { useRef } from 'react';
import {
  asNodeId,
  boundsOfPath,
  DEFAULT_PALETTE,
  useEllipseTool,
  useLassoTool,
  useLineTool,
  usePencilTool,
  usePenTool,
  usePolygonTool,
  useRectTool,
  useStarTool,
  useTextTool,
} from '@weasel-js/core';
import type { AnyTool, LassoHitMode, NodeId, Path, PolygonPath, Scene, SceneNode } from '@weasel-js/core';
import type { SceneCanvasAdapter } from '../sceneAdapter';
import type { BuiltinShapeToolId } from './shapeKinds';

/** Per-tool option overrides for the built-in shape/lasso tools.
 *  Each entry is a narrow subset of the underlying hook's options surface
 *  — just the knobs that need consumer control under the bundle pattern. */
export interface BuiltinToolOptions {
  lasso?: { mode?: LassoHitMode };
  /** Snap world-space points to the active grid (or any other snap target).
   *
   *  Registered as the `snap` dep, which `insertAction` applies to the
   *  drag start and current point — so the live preview and the committed
   *  geometry agree — and which the pen tool reads for its own anchor
   *  placement. Covers every drag-to-insert tool (rect / ellipse / line /
   *  polygon / star / text); freehand pencil samples are deliberately left
   *  unsnapped. */
  snapPoint?: (p: { x: number; y: number }) => { x: number; y: number };
}

// `BuiltinShapeToolId` / `KIT_SHAPE_KINDS` live in `./shapeKinds`, a
// dependency-free module, so barrel-reachable code can import them without
// entering this file's `@weasel-js/core` self-import cycle. Re-exported here
// so existing importers of this module keep working unchanged.
export { KIT_SHAPE_KINDS } from './shapeKinds';
export type { BuiltinShapeToolId } from './shapeKinds';

export interface UseBuiltinShapeToolsArgs<TData, TLayer extends string, TPose> {
  scene: Scene<TData, TLayer, TPose>;
  adapter: SceneCanvasAdapter<TData, TLayer, TPose>;
  /** Per-tool option overrides (lasso mode, etc.). */
  options?: BuiltinToolOptions;
}

export type BuiltinShapeTools = Record<BuiltinShapeToolId, AnyTool>;

/** Synthesize the full shape-tool registry. Hooks always run; consumers
 *  decide via `wants(...)` which to register with `useTools`. */
export function useBuiltinShapeTools<TData, TLayer extends string, TPose>(
  args: UseBuiltinShapeToolsArgs<TData, TLayer, TPose>,
): BuiltinShapeTools {
  const { scene, adapter, options } = args;

  // Per-canvas counter + fill cycler. Refs survive renders and stay
  // private to the SceneCanvas instance.
  const seqRef = useRef(0);
  const freshId = (prefix: string) => asNodeId(`${prefix}-${++seqRef.current}`);
  const nextFill = () => DEFAULT_PALETTE[seqRef.current % DEFAULT_PALETTE.length];

  // First system-or-trivial layer is the default insertion layer. Falls back
  // to 'default' when the scene has none yet (rare — useScene synthesizes
  // a 'default' layer when systemLayers is omitted).
  const layerOf = (): TLayer => (scene.layers[0]?.id ?? ('default' as TLayer));

  // Helper to build the kit's leaf-node template — `data: { path, fill }`
  // matches PATH_PAINTER's `matches`/`paint` contract. The cast through
  // `unknown` reflects the kit's intentional looseness around TData when
  // synthesized defaults are in play.
  type Pose = { x: number; y: number; width: number; height: number };
  const makeLeaf = (
    id: NodeId,
    pose: Pose,
    data: { path: Path; fill: string; stroke?: string; strokeWidth?: number; text?: string },
  ): SceneNode<TData, TLayer, TPose> => ({
    id,
    kind: 'leaf',
    layer: layerOf(),
    pose: pose as unknown as TPose,
    data: data as unknown as TData,
    parent: null,
  });

  type LeafNode = SceneNode<TData, TLayer, TPose> & { id: NodeId };

  const snapPoint = options?.snapPoint;
  // Every drag-to-insert tool is a declarative shell: the drag is owned by
  // the dispatcher's `insertAction` and the node is minted by the `insert`
  // dep (`useInsertDepSource`). Tool-side `create` factories were removed
  // when the dispatcher took over — consumers wanting custom node
  // factories override the dep, not the tool.
  const rect = useRectTool();
  const ellipse = useEllipseTool();
  const line = useLineTool();
  const polygon = usePolygonTool();
  const star = useStarTool();
  const pencil = usePencilTool();
  // Pen: takes an opaque "pose" carrier (here, the committed PolygonPath +
  // closed flag + AABB) and an addNode/setSelection adapter. We construct
  // the carrier in `wrapPath` and unpack it in `addNode` into a
  // PATH_PAINTER-shaped leaf. (Pen is the one built-in still commiting
  // through its own adapter rather than the `insert` dep — see §4b of the
  // 2026-07-27 inspector handoff.)
  // Editing a committed path is not the pen's job — double-click it to
  // enter anchor-edit mode (see `usePenTool`'s PenScratch docs).
  type PenCarrier = { path: PolygonPath; closed: boolean; bounds: { x: number; y: number; width: number; height: number } };
  const pen = usePenTool<PenCarrier>({
    snapPoint,
    wrapPath: (path, { closed }): PenCarrier => {
      const b = boundsOfPath(path);
      return { path, closed, bounds: { x: b.x, y: b.y, width: b.width, height: b.height } };
    },
    adapter: {
      addNode: (carrier) => {
        const id = freshId('pn');
        const stroke = nextFill();
        const node = makeLeaf(id, carrier.bounds, {
          path: carrier.path,
          fill: carrier.closed ? nextFill() : 'transparent',
          stroke,
          strokeWidth: 2,
        }) as LeafNode;
        adapter.insertNode(node);
        return String(id);
      },
      setSelection: (ids) => adapter.setSelection(ids),
    },
  });
  const lasso = useLassoTool(adapter, options?.lasso ?? {});
  const text = useTextTool();
  return { rect, ellipse, line, polygon, star, pen, pencil, lasso, text };
}

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
  ellipsePath,
  linePath,
  rectPath,
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

/** Per-tool option overrides for the built-in shape/lasso tools.
 *  Each entry is a narrow subset of the underlying hook's options surface
 *  — just the knobs that need consumer control under the bundle pattern. */
export interface BuiltinToolOptions {
  lasso?: { mode?: LassoHitMode };
  /** Snap world-space points to the active grid (or any other snap target).
   *  Applied by the rect / ellipse / line tools to every coord they ingest,
   *  so both the live overlay and the committed geometry use snapped
   *  values. polygon / star / pencil / text go through the dispatcher's
   *  `insertAction` descriptor, which doesn't yet honor this hook. */
  snapPoint?: (p: { x: number; y: number }) => { x: number; y: number };
}

/** Default fill palette cycled through for auto-generated shape nodes. */
const DEFAULT_FILLS = ['#7fb069', '#d4a574', '#a48bd4', '#7ab8d4', '#d47a7a'];

/**
 * Built-in shape tool ids handled by this synthesizer. Each maps to a kit
 * tool hook + a default `create` that produces a leaf node compatible with
 * `PATH_PAINTER`.
 *
 * Runtime mirror in `KIT_SHAPE_KINDS` below — keep the two in sync. The
 * `src/index.barrel.test.ts` parity gate enforces that every member of this
 * union is present in the exported tuple.
 */
export type BuiltinShapeToolId =
  | 'rect' | 'ellipse' | 'line' | 'polygon' | 'star' | 'pen' | 'pencil'
  | 'lasso' | 'text';

/** Runtime, iterable list of the shape-tool ids in `BuiltinShapeToolId`.
 *  Surfaced so consumers (e.g. the Bundle Inspector) can enumerate the
 *  builtin shape kinds without re-encoding the union. */
export const KIT_SHAPE_KINDS = [
  'rect', 'ellipse', 'line', 'polygon', 'star', 'pen', 'pencil',
  'lasso', 'text',
] as const satisfies readonly BuiltinShapeToolId[];

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
  const nextFill = () => DEFAULT_FILLS[seqRef.current % DEFAULT_FILLS.length];

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
  const rect = useRectTool<LeafNode>({
    snapPoint,
    create: (b) => makeLeaf(freshId('rc'),
      { x: b.x, y: b.y, width: b.width, height: b.height },
      { path: rectPath(b.x, b.y, b.width, b.height), fill: nextFill() }) as LeafNode,
  });
  const ellipse = useEllipseTool<LeafNode>({
    snapPoint,
    create: (b) => makeLeaf(freshId('el'),
      { x: b.x, y: b.y, width: b.width, height: b.height },
      { path: ellipsePath(b), fill: nextFill() }) as LeafNode,
  });
  const line = useLineTool<LeafNode>({
    snapPoint,
    create: (a, b) => makeLeaf(freshId('ln'), {
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      width: Math.abs(b.x - a.x) || 1,
      height: Math.abs(b.y - a.y) || 1,
    }, {
      path: linePath(a, b),
      fill: nextFill(),
      stroke: nextFill(),
      strokeWidth: 2,
    }) as LeafNode,
  });
  // Polygon and star are minted by `useInsertDepSource` (the kit's
  // `insert` dep). Tool-side `create` callbacks were removed when the
  // dispatcher took over the drag — consumers wanting custom node
  // factories override the `insert` dep, not the tool.
  const polygon = usePolygonTool();
  const star = useStarTool();
  const pencil = usePencilTool<LeafNode>({
    create: (path: PolygonPath) => {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let i = 0; i < path.coords.length; i += 2) {
        const px = path.coords[i], py = path.coords[i + 1];
        if (px < minX) minX = px; if (px > maxX) maxX = px;
        if (py < minY) minY = py; if (py > maxY) maxY = py;
      }
      return makeLeaf(freshId('pe'), {
        x: isFinite(minX) ? minX : 0,
        y: isFinite(minY) ? minY : 0,
        width: isFinite(maxX - minX) ? (maxX - minX) || 1 : 1,
        height: isFinite(maxY - minY) ? (maxY - minY) || 1 : 1,
      }, {
        path: path,
        fill: nextFill(),
        stroke: nextFill(),
        strokeWidth: 2,
      }) as LeafNode;
    },
  });
  // Pen: takes an opaque "pose" carrier (here, the committed PolygonPath +
  // closed flag + AABB) and an addNode/setSelection/applyOps adapter. We
  // construct the carrier in `wrapPath` and unpack it in `addNode` into a
  // PATH_PAINTER-shaped leaf, identical to the rect/ellipse/line factories.
  type PenCarrier = { path: PolygonPath; closed: boolean; bounds: { x: number; y: number; width: number; height: number } };
  const { tool: pen } = usePenTool<PenCarrier>({
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
      applyOps: (ops, label) => adapter.applyOps(ops, label),
    },
    // Default getPathObj: walk the scene for the requested id. When the
    // node's pose is path-shaped (`kind: 'polygon' | 'rect'`), return it as
    // an editable path obj. Sets `tool: 'pen'` for polygons (so the editor
    // treats anchors as freely-movable) and `tool: 'rect'` for the rect
    // subtype (parametric — anchors are corners of an axis-aligned box).
    // Consumers wanting fancier behavior (param overlays for stars/ellipses,
    // tool tagging from data) can override at the SceneCanvas seam in a
    // future iteration.
    getPathObj: (id) => {
      const node = scene.get(asNodeId(id));
      if (!node) return null;
      const pose = node.pose as unknown;
      if (!pose || typeof pose !== 'object' || !('kind' in pose)) return null;
      const kind = (pose as { kind?: string }).kind;
      if (kind === 'polygon') {
        const p = pose as PolygonPath;
        // Polygons close themselves with a trailing `PATH_Z` (0x04) command.
        const lastCmd = p.commands[p.commands.length - 1];
        const closed = lastCmd === 0x04;
        return { path: p, closed, params: undefined, tool: 'pen' };
      }
      if (kind === 'rect') {
        const p = pose as { kind: 'rect'; x: number; y: number; width: number; height: number };
        return { path: p, closed: true, params: undefined, tool: 'rect' };
      }
      return null;
    },
  });
  const lasso = useLassoTool(adapter, options?.lasso ?? {});
  const text = useTextTool<LeafNode>({
    pointInsert: (point) => makeLeaf(freshId('tx'),
      { x: point.x, y: point.y, width: 80, height: 20 },
      { path: rectPath(point.x, point.y, 80, 20), fill: nextFill(), text: 'Text' }) as LeafNode,
  });
  return { rect, ellipse, line, polygon, star, pen, pencil, lasso, text };
}

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
  cloneByAltDrag,
  ellipsePath,
  linePath,
  rectPath,
  regularPolygonPath,
  starPath,
  useCloneTool,
  useEllipseTool,
  useLassoTool,
  useLineTool,
  usePencilTool,
  usePolygonTool,
  useRectTool,
  useStarTool,
  useTextTool,
} from '@orochi235/weasel';
import type { AnyTool, LassoHitMode, NodeId, Path, PolygonPath, Scene, SceneNode } from '@orochi235/weasel';
import type { SceneCanvasAdapter } from '../sceneAdapter';
import type { InsertAdapter } from 'core/adapters/types';

/** Per-tool option overrides for the built-in shape/lasso/clone tools.
 *  Each entry is a narrow subset of the underlying hook's options surface
 *  — just the knobs that need consumer control under the bundle pattern. */
export interface BuiltinToolOptions {
  lasso?: { mode?: LassoHitMode };
  clone?: { cloneSelection?: boolean };
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
  | 'rect' | 'ellipse' | 'line' | 'polygon' | 'star' | 'pencil'
  | 'lasso' | 'text' | 'clone';

/** Runtime, iterable list of the shape-tool ids in `BuiltinShapeToolId`.
 *  Surfaced so consumers (e.g. the Bundle Inspector) can enumerate the
 *  builtin shape kinds without re-encoding the union. */
export const KIT_SHAPE_KINDS = [
  'rect', 'ellipse', 'line', 'polygon', 'star', 'pencil',
  'lasso', 'text', 'clone',
] as const satisfies readonly BuiltinShapeToolId[];

export interface UseBuiltinShapeToolsArgs<TData, TLayer extends string, TPose> {
  scene: Scene<TData, TLayer, TPose>;
  adapter: SceneCanvasAdapter<TData, TLayer, TPose>;
  /** Per-tool option overrides (lasso mode, clone-selection, etc.). */
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

  const rect = useRectTool<LeafNode>({
    create: (b) => makeLeaf(freshId('rc'),
      { x: b.x, y: b.y, width: b.width, height: b.height },
      { path: rectPath(b.x, b.y, b.width, b.height), fill: nextFill() }) as LeafNode,
  });
  const ellipse = useEllipseTool<LeafNode>({
    create: (b) => makeLeaf(freshId('el'),
      { x: b.x, y: b.y, width: b.width, height: b.height },
      { path: ellipsePath(b), fill: nextFill() }) as LeafNode,
  });
  const line = useLineTool<LeafNode>({
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
  const polygon = usePolygonTool<LeafNode>({
    create: (center, radius, rotation, sides) => makeLeaf(freshId('pg'), {
      x: center.x - radius, y: center.y - radius,
      width: radius * 2, height: radius * 2,
    }, {
      path: regularPolygonPath(center, radius, sides, rotation),
      fill: nextFill(),
    }) as LeafNode,
  });
  const star = useStarTool<LeafNode>({
    create: (center, outerRadius, innerRadius, rotation, points) => makeLeaf(freshId('st'), {
      x: center.x - outerRadius, y: center.y - outerRadius,
      width: outerRadius * 2, height: outerRadius * 2,
    }, {
      path: starPath(center, outerRadius, points, innerRadius, rotation),
      fill: nextFill(),
    }) as LeafNode,
  });
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
  const lasso = useLassoTool(adapter, options?.lasso ?? {});
  const text = useTextTool<LeafNode>({
    pointInsert: (point) => makeLeaf(freshId('tx'),
      { x: point.x, y: point.y, width: 80, height: 20 },
      { path: rectPath(point.x, point.y, 80, 20), fill: nextFill(), text: 'Text' }) as LeafNode,
  });
  // Clone needs a complete InsertAdapter — sceneToAdapter omits commitInsert
  // / commitPaste / snapshotSelection by default. Stub them; clone only
  // calls snapshotSelection in practice (cloneByAltDrag handles paste via
  // its own behavior).
  const cloneAdapter: InsertAdapter<LeafNode> = {
    ...(adapter as unknown as InsertAdapter<LeafNode>),
    commitInsert: () => null,
    commitPaste: () => [],
    snapshotSelection: (ids) => ({
      items: ids
        .map((id) => scene.get(asNodeId(id)))
        .filter((n): n is LeafNode => n != null),
    }),
  };
  const clone = useCloneTool<LeafNode>(cloneAdapter, {
    behaviors: [cloneByAltDrag()],
    ...(options?.clone?.cloneSelection !== undefined
      ? { cloneSelection: options.clone.cloneSelection }
      : {}),
  });

  return { rect, ellipse, line, polygon, star, pencil, lasso, text, clone };
}

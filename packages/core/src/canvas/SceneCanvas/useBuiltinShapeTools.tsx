/**
 * Shape-tool synthesis for `<SceneCanvas>` — calls the kit's per-shape tool
 * hooks; the `insert` dep mints each tool's node. Lets consumers opt into
 * a complete drawing toolset via `<SceneCanvas defaultTools={['rect', 'ellipse']}>`
 * without writing per-tool factory code.
 *
 * All hooks are always called (React rules of hooks) — `resolveToolRegistry`
 * decides which the canvas registers.
 */
import { useEllipseTool } from 'tools/builtin/ellipse/useEllipseTool';
import { useLassoTool } from 'tools/builtin/lasso/useLassoTool';
import { useLineTool } from 'tools/builtin/line/useLineTool';
import { usePencilTool } from 'tools/builtin/pencil/usePencilTool';
import { usePenTool } from 'tools/builtin/pen/usePenTool';
import { usePolygonTool } from 'tools/builtin/polygon/usePolygonTool';
import { useRectTool } from 'tools/builtin/rect/useRectTool';
import { useStarTool } from 'tools/builtin/star/useStarTool';
import { useTextTool } from 'tools/builtin/text/useTextTool';
import { useStickyTool } from 'tools/builtin/sticky/useStickyTool';
import type { StickyStyle } from 'tools/builtin/sticky/stickyNode';
import type { Tool } from 'tools/overlayBinding';
import type { InsertToolOptions } from 'tools/builtin/shared/insertToolOptions';
import type { LassoHitMode } from 'core/adapters/types';
import type { BuiltinShapeToolId } from 'core/shapeKinds';
import type { NodeId } from 'core/scene/types';
import type { RigEditState } from 'tools/builtin/bone/rigEditState';

/** Per-tool option overrides for the built-in tools.
 *  Each entry is a narrow subset of the underlying hook's options surface
 *  — just the knobs that need consumer control under the bundle pattern. */
export interface BuiltinToolOptions {
  lasso?: { mode?: LassoHitMode };
  /** Insert-action options for every drag-to-insert tool (rect / ellipse /
   *  line / polygon / star / pencil / text / sticky): `behaviors` become each insert
   *  binding's `opts.behaviors`, the way `selectTool.move.behaviors` do for
   *  move. */
  insert?: InsertToolOptions;
  /** The look of the notes the sticky tool makes: paper, ink, padding,
   *  typography, and the size a click places. */
  sticky?: StickyStyle;
  /** The knife: screen px around the first point within which a click closes the cut. */
  slice?: { closeHitRadius?: number };
  /** The bone and weight tools. `rig` names the node they edit; by default the one
   *  selected node, or the nearest ancestor of it holding `data.skeleton`. `state` is the
   *  joint they share, which a canvas otherwise makes for itself; pass the one handed to
   *  `useRigNode` as `painting` so a stroke shows as it is painted. `reach` is the screen
   *  px around a joint within which a press takes it. */
  rig?: { rig?: () => NodeId | null; state?: RigEditState; reach?: number };
  /** The weight tool's brush radius, in screen px. */
  weight?: { radius?: number };
}

// `BuiltinShapeToolId` / `KIT_SHAPE_KINDS` derive from the `core/shapeKinds`
// table, a dependency-free module, so barrel-reachable code can reach them
// without entering this file's `@weasel-js/core` self-import cycle.
// Re-exported here so existing importers of this module keep working.
export { KIT_SHAPE_KINDS } from 'core/shapeKinds';
export type { BuiltinShapeToolId } from 'core/shapeKinds';

export interface UseBuiltinShapeToolsArgs {
  /** Per-tool option overrides (lasso mode, etc.). */
  options?: BuiltinToolOptions;
}

export type BuiltinShapeTools = Record<BuiltinShapeToolId, Tool>;

/** Synthesize the full shape-tool registry. Hooks always run;
 *  `useBuiltinTools` registers the ones asked for. */
export function useBuiltinShapeTools(args: UseBuiltinShapeToolsArgs = {}): BuiltinShapeTools {
  const { options } = args;

  // Every tool here is a declarative shell: the `insert` dep
  // (`useInsertDepSource`) mints the node, so a consumer wanting its own node
  // shape overrides the dep, not the tool.
  const insert = options?.insert ?? {};
  const rect = useRectTool(insert);
  const ellipse = useEllipseTool(insert);
  const line = useLineTool(insert);
  const polygon = usePolygonTool(insert);
  const star = useStarTool(insert);
  const pencil = usePencilTool(insert);
  const pen = usePenTool();
  const lasso = useLassoTool(options?.lasso ?? {});
  const text = useTextTool(insert);
  const sticky = useStickyTool({ ...insert, ...options?.sticky });
  return { rect, ellipse, line, polygon, star, pen, pencil, lasso, text, sticky };
}

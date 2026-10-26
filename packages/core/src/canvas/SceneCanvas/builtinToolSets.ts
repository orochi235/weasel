import { KIT_SHAPE_KINDS, kitShapeKindsOf, type BuiltinShapeToolId } from 'core/shapeKinds';
import { toolIdsOf, toolSet, type ToolSet } from '@weasel-js/routing';

/** Built-in tool ids SceneCanvas knows how to mount, through `defaultTools` or a preset. */
export type BuiltinToolId = 'select' | 'hand' | BuiltinShapeToolId | 'slice';

/** The selection tools: click and marquee, and the lasso. */
export const SELECT_TOOLS: ToolSet<BuiltinToolId> = toolSet('select', ['select', ...kitShapeKindsOf('select')]);
/** The view tools. */
export const VIEW_TOOLS: ToolSet<BuiltinToolId> = toolSet('view', ['hand']);
/** The tools that drag out a closed or open primitive. */
export const SHAPE_TOOLS: ToolSet<BuiltinToolId> = toolSet('shape', kitShapeKindsOf('shape'));
/** The freehand and bezier path tools. */
export const DRAW_TOOLS: ToolSet<BuiltinToolId> = toolSet('draw', kitShapeKindsOf('draw'));
/** The text tools: text and the sticky note. */
export const TYPE_TOOLS: ToolSet<BuiltinToolId> = toolSet('type', kitShapeKindsOf('type'));
/** The tools that cut the page itself. */
export const PAGE_TOOLS: ToolSet<BuiltinToolId> = toolSet('page', ['slice']);

/** The built-in tool sets in palette order: selection, then navigation, then the tools that make
 *  things. Each set is named for the presentation group its tools sit in. */
export const BUILTIN_TOOL_GROUPS: readonly ToolSet<BuiltinToolId>[] = [
  SELECT_TOOLS, VIEW_TOOLS, SHAPE_TOOLS, DRAW_TOOLS, TYPE_TOOLS, PAGE_TOOLS,
];

/** The natural order of palette groups, which `ToolPalette` follows unless given its own. */
export const TOOL_GROUP_ORDER: readonly string[] = BUILTIN_TOOL_GROUPS.map((set) => set.id);

/** Every built-in tool, in palette order: {@link BUILTIN_TOOL_GROUPS} one after another, then any
 *  shape kind in no family. */
export const BUILTIN_TOOLS: ToolSet<BuiltinToolId> = toolSet('builtin', [...BUILTIN_TOOL_GROUPS, ...KIT_SHAPE_KINDS]);

/** Every built-in tool id, in palette order: {@link BUILTIN_TOOLS} opened. A palette orders the
 *  tools within each group by it. */
export const BUILTIN_TOOL_IDS: readonly BuiltinToolId[] = toolIdsOf([BUILTIN_TOOLS]);

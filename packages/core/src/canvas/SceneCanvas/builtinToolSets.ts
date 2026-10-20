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

/** Every built-in tool, in palette order: the navigation tools, the shape-kind
 *  table's tools in its order, then the knife. */
export const BUILTIN_TOOLS: ToolSet<BuiltinToolId> = toolSet('builtin', [
  'select', 'hand', ...KIT_SHAPE_KINDS, PAGE_TOOLS,
]);

/** Every built-in tool id, in palette order: {@link BUILTIN_TOOLS} opened. */
export const BUILTIN_TOOL_IDS: readonly BuiltinToolId[] = toolIdsOf([BUILTIN_TOOLS]);

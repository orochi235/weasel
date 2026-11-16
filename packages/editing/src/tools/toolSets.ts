import { KIT_SHAPE_KINDS, kitShapeKindsOf, VIEW_TOOLS, type BuiltinShapeToolId, type BuiltinToolId } from '@weasel-js/core';
import { toolIdsOf, toolSet, type ToolSet } from '@weasel-js/routing';

/** Every tool id the kit ships: core's own (the hand) and the ones editing's presets offer. */
export type KitToolId = BuiltinToolId | 'select' | BuiltinShapeToolId;

/** The selection tools: click and marquee, and the lasso. */
export const SELECT_TOOLS: ToolSet<KitToolId> = toolSet('select', ['select', ...kitShapeKindsOf('select')], { label: 'Select' });
/** The tools that drag out a closed or open primitive. */
export const SHAPE_TOOLS: ToolSet<KitToolId> = toolSet('shape', kitShapeKindsOf('shape'), { label: 'Shapes' });

/** The kit's tool sets in palette order: selection, then navigation, then the tools that make things. Each set is
 *  named for the presentation group its tools sit in. */
export const BUILTIN_TOOL_GROUPS: readonly ToolSet<KitToolId>[] = [SELECT_TOOLS, VIEW_TOOLS, SHAPE_TOOLS];

/** The natural order of palette groups, as `ToolPalette`'s `groupOrder`. */
export const TOOL_GROUP_ORDER: readonly string[] = BUILTIN_TOOL_GROUPS.map((set) => set.id);

/** Every kit tool, in palette order: {@link BUILTIN_TOOL_GROUPS} one after another, then any shape kind in no
 *  family. */
export const BUILTIN_TOOLS: ToolSet<KitToolId> = toolSet('builtin', [...BUILTIN_TOOL_GROUPS, ...KIT_SHAPE_KINDS], { label: 'Tools' });

/** Every kit tool id, in palette order: {@link BUILTIN_TOOLS} opened. A palette orders the tools within each group
 *  by it. */
export const BUILTIN_TOOL_IDS: readonly KitToolId[] = toolIdsOf([BUILTIN_TOOLS]);

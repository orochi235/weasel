import { SELECT_TOOLS, SHAPE_TOOLS, TYPE_TOOLS, VIEW_TOOLS } from '../builtinToolSets';
import type { ToolSet } from '@weasel-js/routing';
import type { FeaturePreset } from '../features';
import type { BuiltinToolId } from '../props';

const toolsOf = (set: ToolSet<BuiltinToolId>, label: string): FeaturePreset =>
  ({ id: `tools:${set.id}`, label, tools: [set] });

/** The select tool and the lasso. */
export const selectToolsPreset = toolsOf(SELECT_TOOLS, 'Selection tools');
/** The hand tool. */
export const viewToolsPreset = toolsOf(VIEW_TOOLS, 'View tools');
/** The tools that drag out a primitive: rect, ellipse, line, polygon, star. */
export const shapeToolsPreset = toolsOf(SHAPE_TOOLS, 'Shape tools');
/** Text and the sticky note. */
export const typeToolsPreset = toolsOf(TYPE_TOOLS, 'Text tools');

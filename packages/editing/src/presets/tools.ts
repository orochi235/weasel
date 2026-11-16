import { SELECT_TOOLS, SHAPE_TOOLS } from '@weasel-js/core';
import type { ToolSet } from '@weasel-js/routing';
import type { FeaturePreset, BuiltinToolId } from '@weasel-js/core';

const toolsOf = (set: ToolSet<BuiltinToolId>, label: string): FeaturePreset =>
  ({ id: `tools:${set.id}`, label, tools: [set] });

/** The select tool and the lasso. */
export const selectToolsPreset = toolsOf(SELECT_TOOLS, 'Selection tools');
/** The tools that drag out a primitive: rect, ellipse, line, polygon, star. */
export const shapeToolsPreset = toolsOf(SHAPE_TOOLS, 'Shape tools');

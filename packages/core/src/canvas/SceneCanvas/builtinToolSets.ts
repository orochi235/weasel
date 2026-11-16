import { toolSet, type ToolSet } from '@weasel-js/routing';
import type {} from '../../interactions/actions/actionParamSchema';

/** The tools core mounts itself, through `defaultTools`, a preset or a `tools` patch: the select tool and the hand. */
export type BuiltinToolId = 'select' | 'hand';

/** The view tools. */
export const VIEW_TOOLS: ToolSet<BuiltinToolId> = toolSet('view', ['hand'], { label: 'View' });

/** Core's own tools, in the order a canvas registers them, ahead of the tools its presets offer. */
export const BUILTIN_TOOL_IDS: readonly BuiltinToolId[] = ['select', 'hand'];

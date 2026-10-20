import { toolSet, type ToolSet } from '@weasel-js/core';

/** The ids `useRigTools` keys its tools by. */
export type RigToolId = 'bone' | 'weight';

/** The rigging tools: bones, and the weights that bind a mesh to them. */
export const RIG_TOOLS: ToolSet<RigToolId> = toolSet('rig', ['bone', 'weight']);

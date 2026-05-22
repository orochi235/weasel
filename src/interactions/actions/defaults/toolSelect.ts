import type { Action } from '../registry';
import type { ImmediateInvoker } from '../invoker';
import type { ActiveToolContextValue } from '../activeToolContext';

/** Key specification for tool-select action. */
export interface ToolSelectKeyOpts {
  key: string;
  mod?: boolean;
  alt?: boolean;
  shift?: boolean | 'optional';
}

/** Build a tool-switch action: pressing `key` (with optional modifiers)
 *  activates the tool with id `toolId`. Registers under id
 *  `tool.select.<toolId>` with `scope: 'hotkey'` so a tap on the bound key
 *  always wins over the currently active tool's own keyDown bindings. */
export function makeToolSelectAction(
  toolId: string,
  keyOpts: ToolSelectKeyOpts,
): Action {
  const invoker: ImmediateInvoker = {
    timing: 'immediate',
    run: (deps) => {
      const activeTool = deps.activeTool as ActiveToolContextValue | undefined;
      if (!activeTool) return;
      activeTool.setActive(toolId);
    },
  };

  return {
    id: `tool.select.${toolId}`,
    label: `Select ${toolId}`,
    defaultBinding: {
      kind: 'key',
      key: keyOpts.key,
      ...(keyOpts.mod !== undefined && { mod: keyOpts.mod }),
      ...(keyOpts.alt !== undefined && { alt: keyOpts.alt }),
      ...(keyOpts.shift !== undefined && { shift: keyOpts.shift }),
    },
    scope: 'hotkey',
    invoker,
    // Declare which deps this action requires. The dispatcher uses this to
    // assemble the ActionDeps bag.
    requires: ['activeTool'],
  } as Action & { requires: string[] };
}

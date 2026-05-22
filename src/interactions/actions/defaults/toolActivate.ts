import type { Action } from '../registry';
import type { ImmediateInvoker } from '../invoker';
import type { ActiveToolContextValue } from '../activeToolContext';

/** Build a tool-activation action: calling this action activates the tool
 *  with id `toolId`. Registers under id `tool.activate.<toolId>`.
 *
 *  This action has no `defaultBinding` — it is not bound to any input
 *  directly. Instead it is invoked by name from `tool.shortcut.<toolId>`
 *  (keyboard shortcut) or any other surface that wants to activate a tool
 *  programmatically (command palette, toolbar click, etc.).
 *
 *  @param toolId - The id of the tool to activate.
 */
export function makeToolActivateAction(toolId: string): Action {
  const invoker: ImmediateInvoker = {
    timing: 'immediate',
    run: (deps) => {
      const activeTool = deps.activeTool as ActiveToolContextValue | undefined;
      if (!activeTool) return;
      activeTool.setActive(toolId);
    },
  };

  return {
    id: `tool.activate.${toolId}`,
    label: `Activate ${toolId}`,
    invoker,
    // Declare which deps this action requires. The dispatcher uses this to
    // assemble the ActionDeps bag.
    requires: ['activeTool'],
  } as Action & { requires: string[] };
}

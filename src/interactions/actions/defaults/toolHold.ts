import type { Action } from '../registry';
import type { InvocationCtx } from '../invoker';
import type { ActiveToolContextValue } from '../activeToolContext';

/** Create an ongoing-action descriptor for "hold key to engage tool"
 *  (e.g. Space-for-hand). The action's start pushes the tool's id to
 *  the active-tool context's hotkeyStack; onEnd pops it.
 *
 *  Registered per-tool by useKeybindings (Phase 5 T3) for each tool
 *  declaring `hotkey: '...'`. The action id is `tool.hold.<toolId>`.
 *
 *  @param toolId - The id of the tool to engage on hold.
 *  @param key - The key spec for the binding (e.g. ' ' for space).
 */
export function makeToolHoldAction(toolId: string, key: string | string[]): Action {
  return {
    id: `tool.hold.${toolId}`,
    label: `Hold for ${toolId}`,
    gestureBinding: { kind: 'key-held', key },
    invoker: {
      timing: 'ongoing',
      start: (ctx: InvocationCtx) => {
        const activeTool = ctx.deps.activeTool as ActiveToolContextValue | undefined;
        if (!activeTool) return {};
        activeTool.pushHotkey(toolId);
        return {
          onEnd: () => { activeTool.popHotkey(); },
        };
      },
    },
    // Phase 4+: declare which deps this action requires.
    // The dispatcher uses this to assemble the ActionDeps bag.
    requires: ['activeTool'],
  } as Action & { requires: string[] };
}

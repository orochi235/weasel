import type { Action } from '../registry';
import { ActionDisabledReason } from '../registry';
import type { ImmediateInvoker } from '../invoker';
import type { ActiveToolContextValue } from '../activeToolContext';

/** Canonical id of the "Escape returns to the default tool" action. */
export const TOOL_RESET_TO_DEFAULT_ID = 'tool.resetToDefault';

/**
 * Build the Escape-returns-to-default-tool action.
 *
 * This used to live in a raw document `keydown` listener inside
 * `useKeybindings`, running alongside — and unaware of — the dispatcher's own
 * Escape bindings (`cancelGesture`, `exitPathEdit`, `escape`). Both fired on
 * the same keypress because they were separate listeners.
 *
 * As an Action it joins the dispatcher's Escape ladder, which is
 * first-match-wins. It registers at ambient scope, the lowest priority, so
 * one Escape press does exactly one thing, in this order:
 *
 *   1. cancel an in-flight gesture
 *   2. exit path-anchor edit mode
 *   3. clear the selection
 *   4. return to the default tool   ← this action
 *
 * That IS a behavior change from "reset the tool *and* clear the selection on
 * the same press." The ladder is the coherent reading of Escape, and the old
 * pairing was an artifact of two uncoordinated listeners rather than a design.
 *
 * `getTarget` returns the tool id to return to, or `null` when the behavior
 * is disabled (consumer passed `defaultTool: null`) or already satisfied.
 */
export function makeToolResetToDefaultAction(
  getTarget: () => string | null,
): Action {
  const invoker: ImmediateInvoker = {
    timing: 'immediate',
    run: (deps) => {
      const activeTool = deps.activeTool as ActiveToolContextValue | undefined;
      const target = getTarget();
      if (!activeTool || !target) return;
      activeTool.setActive(target);
    },
  };

  return {
    id: TOOL_RESET_TO_DEFAULT_ID,
    label: 'Return to default tool',
    defaultBinding: { kind: 'key', key: 'Escape' },
    invoker,
    requires: ['activeTool'],
    // Report disabled (rather than silently no-op'ing) when there's nothing
    // to return to, so the dispatcher falls through and the keypress isn't
    // swallowed.
    enabled: () => (getTarget() ? true : ActionDisabledReason.NotApplicable),
  } as Action & { requires: string[] };
}

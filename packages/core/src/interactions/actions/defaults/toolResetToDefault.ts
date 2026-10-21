import type { Action } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import type { ImmediateInvoker } from '@weasel-js/routing';

/** Canonical id of the "Escape returns to the default tool" action. */
export const TOOL_RESET_TO_DEFAULT_ID = 'tool.resetToDefault';

/**
 * Build the Escape-returns-to-default-tool action.
 *
 * It joins the dispatcher's Escape order, which is first-match-wins, at
 * ambient scope, the lowest priority, so one Escape press does exactly one
 * thing, in this order:
 *
 *   1. cancel an in-flight gesture
 *   2. exit path-anchor edit mode
 *   3. clear the selection
 *   4. return to the default tool   ← this action
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
      const activeTool = deps.activeTool;
      const target = getTarget();
      if (!activeTool || !target) return;
      activeTool.setActive(target);
    },
  };

  return {
    id: TOOL_RESET_TO_DEFAULT_ID,
    label: 'Return to default tool',
    defaultBinding: [{ spec: { kind: 'key', key: 'Escape' }, opts: { id: 'tool.resetToDefault.key' } }],
    invoker,
    requires: ['activeTool'],
    // Report disabled (rather than silently no-op'ing) when there's nothing
    // to return to, so the dispatcher falls through and the keypress isn't
    // swallowed.
    enabled: () => (getTarget() ? true : ActionDisabledReason.NotApplicable),
  } as Action & { requires: string[] };
}

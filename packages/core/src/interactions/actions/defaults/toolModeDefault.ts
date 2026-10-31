import type { Action, ImmediateInvoker } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';

/** Canonical id of the "Escape returns to the mode's default tool" action. */
export const TOOL_MODE_DEFAULT_ID = 'tool.modeDefault';

/**
 * Build the action Escape takes, in a mode that names a `defaultTool`, while
 * another tool is active: it makes the default tool active again, and the
 * next Escape is the mode's own. Mid-drag, Escape is `cancelGesture`'s.
 *
 * It rides the hotkey tier, as the mode shortcuts do, so it outranks the rest
 * of the Escape ladder (clearing the selection, `exitPathEdit`), and a mode
 * shortcut's `exit` yields to it. `getTarget` returns the tool to return to,
 * or null when the mode names none, the canvas does not mount it, or it is
 * already active.
 */
export function makeToolModeDefaultAction(getTarget: () => string | null): Action {
  const invoker: ImmediateInvoker = {
    timing: 'immediate',
    run: (deps) => {
      const target = getTarget();
      if (target) deps.activeTool?.setActive(target);
    },
  };
  return {
    id: TOOL_MODE_DEFAULT_ID,
    label: "Return to the mode's tool",
    scope: 'hotkey',
    defaultBinding: [{
      spec: { kind: 'key', key: 'Escape', phase: [{ channel: '*', phase: 'initial' }] },
      opts: { id: 'tool.modeDefault.key' },
    }],
    invoker,
    requires: ['activeTool'],
    enabled: () => (getTarget() ? true : ActionDisabledReason.NotApplicable),
  } as Action & { requires: string[] };
}

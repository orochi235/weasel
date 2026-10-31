import type { ActionDeps } from '../interactions/actions/invoker';

/**
 * Make the active mode's default tool active when another tool holds the
 * slot, and say whether it did. A key that leaves a mode calls this first, so
 * one press returns to the mode's tool and the next leaves: the mode shortcuts'
 * `exit` and `cancel`, and core's `exitPathEdit`. Reads the `activeTool` and
 * `modeDefaultTool` deps, which the caller must require.
 */
export function returnToModeDefault(deps: ActionDeps | undefined): boolean {
  const target = deps?.modeDefaultTool?.() ?? null;
  const tools = deps?.activeTool;
  if (target === null || !tools || tools.active === target) return false;
  tools.setActive(target);
  return true;
}

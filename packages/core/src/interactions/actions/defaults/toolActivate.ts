import type { Action } from '@weasel-js/routing';
import type { BoundGesture } from '@weasel-js/routing';
import type { ImmediateInvoker } from '@weasel-js/routing';

/** Canonical id of the consolidated tool-activation action. One descriptor
 *  serves every tool; the matched binding (or imperative caller) supplies
 *  `params.toolId` to select which tool to activate. */
export const TOOL_ACTIVATE_ID = 'tool.activate';

/** Per-tool key spec consumed by `makeToolActivateAction`. `mod/alt/shift`
 *  sit at the top level, mirroring the `KeyBinding` shape tools declare. */
export interface ToolActivateKeyOpts {
  key: string;
  mod?: boolean;
  alt?: boolean;
  shift?: boolean | 'optional';
}

/** Single entry pairing a tool id with the key spec that activates it. */
export interface ToolActivateBindingSpec {
  toolId: string;
  keyOpts: ToolActivateKeyOpts;
}

/** Build the per-tool `BoundGesture` list for the consolidated action's
 *  `defaultBinding`. Each entry carries `opts.params.toolId` so the
 *  invoker's `run` can pick out which tool to activate. */
export function buildToolActivateBindings(
  specs: readonly ToolActivateBindingSpec[],
): BoundGesture[] {
  const seen = new Set<string>();
  return specs.map(({ toolId, keyOpts }) => {
    const id = seen.has(toolId) ? `${TOOL_ACTIVATE_ID}.${toolId}.${keyOpts.key}` : `${TOOL_ACTIVATE_ID}.${toolId}`;
    seen.add(toolId);
    // Modifiers belong under `mods` (a `ModSpec`), not at the top level of
    // the spec: the matcher treats an absent modifier as "must NOT be held".
    const mods: Record<string, boolean | 'optional'> = {};
    if (keyOpts.mod !== undefined) mods.mod = keyOpts.mod;
    if (keyOpts.alt !== undefined) mods.alt = keyOpts.alt;
    if (keyOpts.shift !== undefined) mods.shift = keyOpts.shift;
    return {
      spec: {
        kind: 'key',
        key: keyOpts.key,
        ...(Object.keys(mods).length > 0 ? { mods } : {}),
      },
      opts: { id, params: { toolId } },
    } as BoundGesture;
  });
}

/** Build the consolidated `tool.activate` action. `bindings` enumerates one
 *  `{ spec, opts: { params: { toolId } } }` per tool. Imperative callers reach
 *  the same effect via `registry.trigger('tool.activate', { toolId })`.
 *
 *  `isEligible` gates activation per tool, which the static per-action
 *  `Action.eligible` cannot. Omit it for consumers with no mode registry. */
export function makeToolActivateAction(
  bindings: BoundGesture[],
  isEligible?: (toolId: string) => boolean,
): Action {
  const invoker: ImmediateInvoker = {
    timing: 'immediate',
    run: (deps, params) => {
      const activeTool = deps.activeTool;
      const toolId = params?.toolId as string | undefined;
      if (!activeTool || !toolId) return;
      // Grayed out in the palette ⇒ not reachable by shortcut either.
      if (isEligible && !isEligible(toolId)) return;
      activeTool.setActive(toolId);
    },
  };

  return {
    id: TOOL_ACTIVATE_ID,
    label: 'Activate tool',
    defaultBinding: bindings,
    scope: 'hotkey',
    invoker,
    requires: ['activeTool'],
  } as Action & { requires: string[] };
}

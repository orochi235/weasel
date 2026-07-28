import type { Action, BoundGesture } from '../registry';
import type { ImmediateInvoker } from '../invoker';
import type { ActiveToolContextValue } from '../activeToolContext';

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
  return specs.map(({ toolId, keyOpts }) => {
    // Modifiers belong under `mods` (a `ModSpec`), not at the top level of
    // the spec. They used to be spread flat and the mismatch was hidden by an
    // `as never` cast, so the matcher — which treats an absent modifier as
    // "must NOT be held" — could never match a modifier-qualified shortcut
    // like Cmd+D. Nobody noticed while `useKeybindings`'s own document
    // listener was doing the real matching.
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
      opts: { params: { toolId } },
    } as BoundGesture;
  });
}

/** Build the consolidated `tool.activate` action. `bindings` enumerates one
 *  `{ spec, opts: { params: { toolId } } }` per tool; the invoker reads
 *  `params.toolId` and calls `activeTool.setActive(toolId)`. Imperative
 *  callers (palette, toolbar) reach the same effect via
 *  `registry.trigger('tool.activate', { toolId })`.
 *
 *  `isEligible` gates activation on the tool's `capabilities` vs the active
 *  mode — the same predicate `ToolPalette` uses to grey a button out. It has
 *  to live in the invoker rather than in `Action.eligible` because eligibility
 *  here is per-TOOL (read off `params.toolId`), while `Action.eligible` is a
 *  static per-action descriptor. Omit it (or pass one that always returns
 *  true) for consumers with no mode registry. */
export function makeToolActivateAction(
  bindings: BoundGesture[],
  isEligible?: (toolId: string) => boolean,
): Action {
  const invoker: ImmediateInvoker = {
    timing: 'immediate',
    run: (deps, params) => {
      const activeTool = deps.activeTool as ActiveToolContextValue | undefined;
      const toolId = params?.toolId as string | undefined;
      if (!activeTool || !toolId) return;
      // Greyed out in the palette ⇒ not reachable by shortcut either. Before
      // this, `Tool.capabilities` described an intent the runtime never
      // enforced: in text-edit mode the palette greyed the pen button while
      // `P` still activated pen.
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

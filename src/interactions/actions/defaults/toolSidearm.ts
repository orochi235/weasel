import type { Action, BoundGesture } from '../registry';
import { resolveParams, type InvocationCtx, type BindingOpts } from '../invoker';
import type { ActiveToolContextValue } from '../activeToolContext';

/** Canonical id of the consolidated tool-sidearm action. One descriptor
 *  serves every tool; the matched binding supplies `params.toolId` to select
 *  which tool to engage while the key is held. */
export const TOOL_SIDEARM_ID = 'tool.sidearm';

/** Per-tool spec consumed by `buildToolSidearmBindings`. The key is the
 *  held-key trigger (e.g. ' ' for Space-for-hand). */
export interface ToolSidearmBindingSpec {
  toolId: string;
  key: string | string[];
}

/** Build the per-tool `BoundGesture` list for the consolidated action's
 *  `defaultBinding`. Each entry pairs a `key-held` spec with
 *  `opts.params.toolId` so the invoker's `start` can pick out which tool
 *  to engage. */
export function buildToolSidearmBindings(
  specs: readonly ToolSidearmBindingSpec[],
): BoundGesture[] {
  return specs.map(({ toolId, key }) => ({
    spec: { kind: 'key-held', key } as never,
    opts: { params: { toolId } },
  }));
}

/** Build the consolidated `tool.sidearm` action — "hold a key to engage a
 *  secondary tool" (e.g. Space-for-hand). `bindings` enumerates one
 *  `{ spec: keyHeld, opts: { params: { toolId } } }` per tool; the invoker
 *  reads `params.toolId` from the matched binding, pushes the tool id onto
 *  the active-tool context's hotkey stack on `start`, and pops it on `onEnd`.
 *  Mirrors the parametric shape of `tool.activate`. */
export function makeToolSidearmAction(bindings: BoundGesture[]): Action {
  return {
    id: TOOL_SIDEARM_ID,
    label: 'Engage tool (sidearm)',
    defaultBinding: bindings,
    scope: 'hotkey',
    invoker: {
      timing: 'ongoing',
      start: (ctx: InvocationCtx, opts?: BindingOpts) => {
        const activeTool = ctx.deps.activeTool as ActiveToolContextValue | undefined;
        const toolId = resolveParams(opts?.params)?.toolId as string | undefined;
        if (!activeTool || !toolId) return {};
        activeTool.pushHotkey(toolId);
        return {
          onEnd: () => { activeTool.popHotkey(); },
        };
      },
    },
    requires: ['activeTool'],
  } as Action & { requires: string[] };
}

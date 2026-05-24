import type { Action, BoundGesture } from '../registry';
import type { ImmediateInvoker } from '../invoker';
import type { ActiveToolContextValue } from '../activeToolContext';

/** Canonical id of the consolidated tool-activation action. One descriptor
 *  serves every tool; the matched binding (or imperative caller) supplies
 *  `params.toolId` to select which tool to activate. */
export const TOOL_ACTIVATE_ID = 'tool.activate';

/** Per-tool key spec consumed by `makeToolActivateAction`. Mirrors the
 *  legacy `ToolShortcutKeyOpts` shape — `mod/alt/shift` at the top level —
 *  so the document-keydown path in `useKeybindings` keeps working as the
 *  authoritative shortcut handler. */
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
  return specs.map(({ toolId, keyOpts }) => ({
    spec: {
      kind: 'key',
      key: keyOpts.key,
      ...(keyOpts.mod !== undefined && { mod: keyOpts.mod }),
      ...(keyOpts.alt !== undefined && { alt: keyOpts.alt }),
      ...(keyOpts.shift !== undefined && { shift: keyOpts.shift }),
    } as never,
    opts: { params: { toolId } },
  }));
}

/** Build the consolidated `tool.activate` action. `bindings` enumerates one
 *  `{ spec, opts: { params: { toolId } } }` per tool; the invoker reads
 *  `params.toolId` and calls `activeTool.setActive(toolId)`. Imperative
 *  callers (palette, toolbar) reach the same effect via
 *  `registry.trigger('tool.activate', { toolId })`. */
export function makeToolActivateAction(bindings: BoundGesture[]): Action {
  const invoker: ImmediateInvoker = {
    timing: 'immediate',
    run: (deps, params) => {
      const activeTool = deps.activeTool as ActiveToolContextValue | undefined;
      const toolId = params?.toolId as string | undefined;
      if (!activeTool || !toolId) return;
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

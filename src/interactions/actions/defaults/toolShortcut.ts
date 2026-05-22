import type { Action } from '../registry';
import type { ImmediateInvoker } from '../invoker';

/** Key specification for tool-shortcut action. */
export interface ToolShortcutKeyOpts {
  key: string;
  mod?: boolean;
  alt?: boolean;
  shift?: boolean | 'optional';
}

/** Build a tool-switch shortcut action: pressing `key` (with optional
 *  modifiers) dispatches `tool.activate.<toolId>` via the provided `trigger`
 *  callback. Registers under id `tool.shortcut.<toolId>` with `scope: 'hotkey'`
 *  so a tap on the bound key always wins over the currently active tool's own
 *  keyDown bindings.
 *
 *  The `trigger` callback is typically `registry.trigger` — provided by the
 *  caller (e.g. `useKeybindings`) at registration time. This keeps the
 *  shortcut factory free of any direct registry import while allowing the
 *  shortcut to dispatch to the activation action by name.
 *
 *  @param toolId   - The id of the tool to activate.
 *  @param keyOpts  - Key specification for the default binding.
 *  @param trigger  - Callback to invoke another action by id at run time.
 */
export function makeToolShortcutAction(
  toolId: string,
  keyOpts: ToolShortcutKeyOpts,
  trigger: (id: string) => boolean,
): Action {
  const invoker: ImmediateInvoker = {
    timing: 'immediate',
    run: () => {
      trigger(`tool.activate.${toolId}`);
    },
  };

  return {
    id: `tool.shortcut.${toolId}`,
    label: `Switch to ${toolId}`,
    defaultBinding: {
      kind: 'key',
      key: keyOpts.key,
      ...(keyOpts.mod !== undefined && { mod: keyOpts.mod }),
      ...(keyOpts.alt !== undefined && { alt: keyOpts.alt }),
      ...(keyOpts.shift !== undefined && { shift: keyOpts.shift }),
    },
    scope: 'hotkey',
    invoker,
  } as Action;
}

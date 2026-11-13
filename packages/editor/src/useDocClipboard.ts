import {
  ActionDisabledReason, useClipboard, useCommand,
  type BoundGesture, type ClipboardDep, type CommandOptions, type UseClipboardOptions, type WorldPoint,
} from '@weasel-js/core';

/** The ids of the commands `useDocClipboard` registers: the kit's own, so a menu naming them finds these. */
export const DOC_CLIPBOARD_ACTIONS = { copy: 'clipboard.copy', paste: 'clipboard.paste' } as const;

/** The keys `useDocClipboard` binds unless told otherwise: Cmd/Ctrl+C and V. */
export const DOC_CLIPBOARD_KEYS = {
  copy: { kind: 'key', key: 'c', mods: { mod: true } },
  paste: { kind: 'key', key: 'v', mods: { mod: true } },
} as const satisfies Record<string, BoundGesture>;

/** How one of `useDocClipboard`'s commands registers. Leaving `keys` out binds its `DOC_CLIPBOARD_KEYS` entry;
 *  `null` binds none. */
export interface DocClipboardCommandOptions extends Pick<CommandOptions, 'icon' | 'group' | 'tags'> {
  label?: string;
  keys?: CommandOptions['keys'] | null;
}

/** Options for `useDocClipboard`: `useClipboard`'s, and how its commands register. */
export interface DocClipboardOptions<TItem> extends UseClipboardOptions<TItem> {
  commands?: { copy?: DocClipboardCommandOptions; paste?: DocClipboardCommandOptions };
}

/**
 * Copy and Paste for an app whose own document owns its nodes: `useClipboard` over the app's `copy` and `paste`,
 * with `clipboard.copy` and `clipboard.paste` registered on the `<ActionsProvider>` in scope, bound to Cmd/Ctrl+C
 * and V. `paste` writes to the document, so the paste is undone the way the document undoes; no scene ops are
 * dispatched. A canvas under it should leave out the `clipboard` feature, which registers the same ids.
 */
export function useDocClipboard<TItem>(options: DocClipboardOptions<TItem>): ClipboardDep {
  const { commands = {}, ...clipboardOptions } = options;
  const clipboard = useClipboard(clipboardOptions);
  const canCopy = () => {
    const ids = options.getSelection();
    return (ids.length > 0 && (options.copy(ids)?.length ?? 0) > 0) || ActionDisabledReason.NotApplicable;
  };
  useDocClipboardCommand('copy', 'Copy', () => clipboard.copy(), canCopy, commands.copy);
  useDocClipboardCommand(
    'paste', 'Paste', (params) => clipboard.paste(params?.world as WorldPoint | undefined),
    () => !clipboard.isEmpty() || ActionDisabledReason.NotApplicable, commands.paste,
  );
  return clipboard;
}

function useDocClipboardCommand(
  slot: keyof typeof DOC_CLIPBOARD_ACTIONS,
  defaultLabel: string,
  run: (params?: Readonly<Record<string, unknown>>) => void,
  enabled: () => true | ActionDisabledReason,
  options: DocClipboardCommandOptions | undefined,
): void {
  const { label = defaultLabel, keys, ...rest } = options ?? {};
  const bound = keys === null ? {} : { keys: keys ?? { spec: DOC_CLIPBOARD_KEYS[slot], opts: { id: `${DOC_CLIPBOARD_ACTIONS[slot]}.key` } } };
  useCommand(DOC_CLIPBOARD_ACTIONS[slot], label, run, { group: 'clipboard', ...rest, ...bound, enabled });
}

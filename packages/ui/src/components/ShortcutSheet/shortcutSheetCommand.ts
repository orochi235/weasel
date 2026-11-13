import { type BoundGesture, type CommandOptions, type KeySpec, useCommand } from '@weasel-js/core';

/** The id of the command that opens the shortcut sheet. */
export const SHORTCUT_SHEET_ID = 'shortcuts.show';

/** `shortcuts.show`'s key unless a host says otherwise: Shift+/, which types `?` on a US layout. `code` holds it to
 *  the key US layouts put / on, whatever another layout types there. */
export const SHORTCUT_SHEET_KEY: KeySpec = { kind: 'key', key: ['/', '?'], code: 'Slash', mods: { shift: true } };

/** How {@link useShortcutSheetCommand} registers. */
export interface ShortcutSheetCommandOptions extends Pick<CommandOptions, 'icon' | 'group' | 'tags'> {
  label?: string;
  /** The gestures that open the sheet, in place of {@link SHORTCUT_SHEET_KEY}; `null` binds none. */
  keys?: BoundGesture | readonly BoundGesture[] | null;
}

const DEFAULT_KEYS: BoundGesture = { spec: SHORTCUT_SHEET_KEY, opts: { id: `${SHORTCUT_SHEET_ID}.key` } };

/** Registers `shortcuts.show`, which calls `open`, bound to Shift+/ unless `options.keys` says otherwise. */
export function useShortcutSheetCommand(open: () => void, options: ShortcutSheetCommandOptions = {}): void {
  const { label = 'Keyboard shortcuts', keys = DEFAULT_KEYS, group = 'help', ...rest } = options;
  useCommand(SHORTCUT_SHEET_ID, label, open, { ...rest, group, ...(keys !== null ? { keys } : {}) });
}

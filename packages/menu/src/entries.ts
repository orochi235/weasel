import type { ShortcutInput } from '@weasel-js/gestures';

/** A key chip: the key, and which modifiers are held with it. `@weasel-js/routing`
 *  derives these from action bindings as `ActionShortcut`. */
export type MenuShortcut = ShortcutInput;

/** A row that runs something when chosen. */
export interface MenuItemEntry {
  kind: 'item';
  key: string;
  label: string;
  /** Opaque to the model; each renderer knows what it can draw. */
  icon?: unknown;
  shortcut?: MenuShortcut;
  disabled?: boolean;
  /** `undefined` for a row with no on/off state. */
  checked?: boolean;
  /** Letter that chooses this row from the keyboard, compared ignoring case. */
  access?: string;
  /** Where choosing the row goes; see `withLinks`. */
  href?: string;
  /** The row for the page that is open. */
  current?: boolean;
  run(): void;
}

/** A rule between groups of rows. Never highlighted. */
export interface MenuSeparatorEntry {
  kind: 'separator';
  key: string;
}

/** A row that opens another level. */
export interface SubmenuEntry {
  kind: 'submenu';
  key: string;
  label: string;
  icon?: unknown;
  disabled?: boolean;
  /** Letter that opens this row from the keyboard, compared ignoring case. */
  access?: string;
  entries: readonly MenuEntry[];
}

/** One line of a menu. */
export type MenuEntry = MenuItemEntry | MenuSeparatorEntry | SubmenuEntry;

/** True for an entry the highlight can land on. */
export function isRow(e: MenuEntry): e is MenuItemEntry | SubmenuEntry {
  return e.kind !== 'separator';
}

/**
 * The entries shown at `level`, following `stack` (the highlighted index at
 * each open level) down from `root`. Empty when the path does not lead to a
 * submenu.
 */
export function entriesAt(
  root: readonly MenuEntry[],
  stack: readonly (number | null)[],
  level: number,
): readonly MenuEntry[] {
  let entries = root;
  for (let i = 0; i < level; i++) {
    const at = stack[i];
    const e = at == null ? undefined : entries[at];
    if (e?.kind !== 'submenu') return [];
    entries = e.entries;
  }
  return entries;
}

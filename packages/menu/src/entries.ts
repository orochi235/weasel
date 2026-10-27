import type { Display, Endless, InfinityText, UnitTable } from '@weasel-js/quantity';

/** A key chip: the key, and which modifiers are held with it. `@weasel-js/routing`
 *  derives these from action bindings as `ActionShortcut`; `@weasel-js/gestures`
 *  formats them as `ShortcutInput`. A tool's `keybinding` has this shape too. */
export interface MenuShortcut {
  /** A list names spellings of one keycap (`['[', '{']`); the first is drawn. */
  key: string | readonly string[];
  mod?: boolean;
  alt?: boolean;
  /** `'optional'` matches held or not, and draws as an optional key. */
  shift?: boolean | 'optional';
  /** For a key inside a keymap: the keymaps that lead to it, outermost first,
   *  each by its label and its leader's shortcut. Drawn `Loupe ▸ 2`. */
  leader?: readonly { label: string; shortcut: Omit<MenuShortcut, 'leader'> }[];
}

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

/** A row holding a number that is edited in place: the menu stays open while it changes. All of it is in the
 *  units shown. Its controller's `numberValue` is what it holds now. */
export interface MenuNumberEntry {
  kind: 'number';
  key: string;
  label: string;
  icon?: unknown;
  disabled?: boolean;
  access?: string;
  /** What it held when the menu opened. `undefined` for none. */
  value: number | undefined;
  min?: number;
  max?: number;
  /** What one step adds. Default 1. */
  step?: number;
  /** Text after the value: `'°'`, `'px'`. */
  suffix?: string;
  /** How the value shows, and reads back where it is typed. Default: every decimal it has. */
  display?: Display;
  /** The ends that stand for infinity, one step past `min` or `max`. */
  endless?: Endless;
  /** The word infinity shows as. Default `∞`. */
  infinity?: InfinityText;
  /** Units a renderer with a field reads typed, each mapped to the factor that turns a number in it into the
   *  unit shown: `{ mm: 0.1, cm: 1 }`. */
  accepts?: Readonly<UnitTable>;
  set(value: number): void;
}

/** A row showing a color, edited from the menu when it has a `set`: the menu stays open while it changes. Its
 *  controller's `colorValue` is what it holds now. A renderer with no color picker draws it read-only. */
export interface MenuColorEntry {
  kind: 'color';
  key: string;
  label: string;
  disabled?: boolean;
  access?: string;
  /** What it held when the menu opened, a CSS color: `#rrggbb` or `#rrggbbaa`. `undefined` for none. */
  value: string | undefined;
  /** Offer opacity, and write `#rrggbbaa`. */
  alpha?: boolean;
  /** Absent, the row is read-only. */
  set?(value: string): void;
}

/** A row holding a line of text that is edited in place: the menu stays open while it changes. Its
 *  controller's `textValue` is what it holds now. A renderer with no text entry draws it read-only. */
export interface MenuTextEntry {
  kind: 'text';
  key: string;
  label: string;
  icon?: unknown;
  disabled?: boolean;
  access?: string;
  /** What it held when the menu opened. `undefined` for none. */
  value: string | undefined;
  set(value: string): void;
}

/** One line of a menu. */
export type MenuEntry =
  | MenuItemEntry | MenuSeparatorEntry | SubmenuEntry | MenuNumberEntry | MenuColorEntry | MenuTextEntry;

/** An entry the highlight can land on. */
export type MenuRowEntry = Exclude<MenuEntry, MenuSeparatorEntry>;

/** True for an entry the highlight can land on. */
export function isRow(e: MenuEntry): e is MenuRowEntry {
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

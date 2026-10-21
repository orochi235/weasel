import type { MenuTextEntry } from './entries';

/** The text rows of one open menu: what each holds now, and how it is written. */
export interface MenuTextValues {
  textValue(e: MenuTextEntry): string | undefined;
  setText(e: MenuTextEntry, value: string): void;
}

/** Text rows that remember what was set while the menu is open, as a menu's number rows do. */
export function createTextValues(changed: () => void, closed: () => boolean): MenuTextValues {
  const held = new Map<MenuTextEntry, string>();
  const textValue = (e: MenuTextEntry) => (held.has(e) ? held.get(e) : e.value);
  const setText = (e: MenuTextEntry, value: string) => {
    if (closed() || e.disabled || value === textValue(e)) return;
    held.set(e, value);
    e.set(value);
    changed();
  };
  return { textValue, setText };
}

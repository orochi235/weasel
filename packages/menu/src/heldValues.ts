import type { MenuColorEntry, MenuTextEntry } from './entries';

/** A row whose value the menu holds while it is open: what it opened with, and what writes it. */
interface Held<T> { value: T | undefined; disabled?: boolean; set?(value: T): void }

/** Rows that remember what was set while the menu is open: what each holds now, and how it is written. */
function createHeld<E extends Held<T>, T>(changed: () => void, closed: () => boolean) {
  const held = new Map<E, T>();
  const valueOf = (e: E): T | undefined => (held.has(e) ? held.get(e) : e.value);
  const write = (e: E, value: T): void => {
    if (closed() || e.disabled || !e.set || value === valueOf(e)) return;
    held.set(e, value);
    e.set(value);
    changed();
  };
  return { valueOf, write };
}

/** The text and color rows of one open menu: what each holds now, and how it is written. */
export interface MenuHeldValues {
  textValue(e: MenuTextEntry): string | undefined;
  setText(e: MenuTextEntry, value: string): void;
  colorValue(e: MenuColorEntry): string | undefined;
  setColor(e: MenuColorEntry, value: string): void;
}

/** Text and color rows that remember what was set while the menu is open, as a menu's number rows do. */
export function createHeldValues(changed: () => void, closed: () => boolean): MenuHeldValues {
  const text = createHeld<MenuTextEntry, string>(changed, closed);
  const color = createHeld<MenuColorEntry, string>(changed, closed);
  return { textValue: text.valueOf, setText: text.write, colorValue: color.valueOf, setColor: color.write };
}

import { firstStop, rovingKey, type ListShape } from '@weasel-js/ui-logic';
import { entriesAt, isRow, type MenuEntry } from './entries';

/** The highlighted index at each open level; its length is how many are open. */
export type MenuStack = readonly (number | null)[];

/** What a key asks the owner of the menu to do beyond moving the highlight. */
export type KeyEffect =
  | { kind: 'none' }
  | { kind: 'choose'; level: number; index: number }
  | { kind: 'close' }
  | { kind: 'edge'; dir: -1 | 1 }
  | { kind: 'step'; level: number; index: number; dir: -1 | 1 };

const NONE: KeyEffect = { kind: 'none' };

/** A menu level as a list: the highlight lands on every row, and never on a separator. */
const MENU_LIST: ListShape<MenuEntry> = { canStop: isRow };

/** Index of the first row, or null for a level with none. */
export function firstRow(entries: readonly MenuEntry[]): number | null {
  return firstStop(entries, MENU_LIST);
}

function withTop(stack: MenuStack, index: number | null): MenuStack {
  return [...stack.slice(0, -1), index];
}

function openSub(root: readonly MenuEntry[], stack: MenuStack): MenuStack | null {
  const level = stack.length - 1;
  const at = stack[level];
  const e = at == null ? undefined : entriesAt(root, stack, level)[at];
  if (e?.kind !== 'submenu' || e.disabled) return null;
  return [...stack, firstRow(e.entries)];
}

/** Apply one key to the menu: the new stack, any effect, and whether the key
 *  was the menu's (an unhandled key goes on to typeahead). */
export function keyStep(
  root: readonly MenuEntry[],
  stack: MenuStack,
  key: string,
): { stack: MenuStack; effect: KeyEffect; handled: boolean } {
  const level = stack.length - 1;
  const rows = entriesAt(root, stack, level);
  const at = stack[level] ?? null;
  const done = (s: MenuStack, effect: KeyEffect = NONE) => ({ stack: s, effect, handled: true });
  const roved = rovingKey(rows, at, key, MENU_LIST);
  if (roved.handled) return done(withTop(stack, roved.at));
  switch (key) {
    case 'ArrowRight': {
      const opened = openSub(root, stack);
      return opened ? done(opened) : done(stack, { kind: 'edge', dir: 1 });
    }
    case 'ArrowLeft': return level > 0 ? done(stack.slice(0, -1)) : done(stack, { kind: 'edge', dir: -1 });
    case 'Escape': return level > 0 ? done(stack.slice(0, -1)) : done(stack, { kind: 'close' });
    case 'Tab': return done(stack, { kind: 'close' });
    case 'Enter':
    case ' ': {
      const e = at == null ? undefined : rows[at];
      if (e?.kind === 'submenu') return done(openSub(root, stack) ?? stack);
      if (e?.kind === 'item' && !e.disabled) return done(stack, { kind: 'choose', level, index: at! });
      return done(stack);
    }
    case '+':
    case '=':
    case '-': {
      // A number row steps; anywhere else these are typed, as any other character is.
      const e = at == null ? undefined : rows[at];
      if (e?.kind !== 'number' || e.disabled) return { stack, effect: NONE, handled: false };
      return done(stack, { kind: 'step', level, index: at!, dir: key === '-' ? -1 : 1 });
    }
    default: return { stack, effect: NONE, handled: false };
  }
}

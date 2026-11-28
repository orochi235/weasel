/** What the keyboard channel remembers about keystrokes that opened or went to a keymap. */
import type { KeymapStack } from '../../../keymaps/keymapStack';

export interface KeymapKeys {
  /** Whether autorepeat of `physical` is to be dropped: it is a leader still down, or its keystroke closed a keymap. */
  quiet(physical: string): boolean;
  /** Run one keystroke's dispatch and note what it did to the keymaps. */
  press(e: KeyboardEvent, physical: string, run: () => void): void;
  /** A key came up. */
  up(e: KeyboardEvent, physical: string): void;
  /** Cmd went down: every key down now may lose its keyup, so Cmd's own keyup stands in for theirs. */
  cmdDown(): void;
  clear(): void;
}

interface Place { id: string; depth: number }

/** The innermost open keymap and how deep it sits; a snapshot is rebuilt whenever a level changes, so identity says nothing. */
function placeOf(s: KeymapStack | undefined): Place | null {
  const open = s?.open() ?? [];
  const top = open.at(-1);
  return top === undefined ? null : { id: top.id, depth: open.length };
}

const samePlace = (a: Place, b: Place | null): boolean => b !== null && a.id === b.id && a.depth === b.depth;

export function keymapKeys(stack: () => KeymapStack | undefined): KeymapKeys {
  // Leader keys still down, each with whether Cmd was held when it went down.
  const leaders = new Map<string, boolean>();
  // Keys whose keystroke closed a keymap, the same way.
  const quiet = new Map<string, boolean>();
  const release = (physical: string): void => {
    if (leaders.delete(physical)) stack()?.release(`key:${physical}`);
  };
  return {
    quiet: (physical) => leaders.has(physical) || quiet.has(physical),
    press: (e, physical, run) => {
      const before = placeOf(stack());
      run();
      const s = stack();
      if (s?.holdOpened(`key:${physical}`)) leaders.set(physical, e.metaKey);
      // Its repeats would otherwise reach whatever the key does outside the keymap it just closed.
      else if (before !== null && !samePlace(before, placeOf(s))) quiet.set(physical, e.metaKey);
    },
    up: (e, physical) => {
      quiet.delete(physical);
      release(physical);
      // macOS sends no keyup for a key released while Cmd is down, so Cmd's own keyup releases it.
      if (e.key !== 'Meta') return;
      for (const [k, withCmd] of [...leaders]) if (withCmd) release(k);
      for (const [k, withCmd] of [...quiet]) if (withCmd) quiet.delete(k);
    },
    cmdDown: () => {
      for (const k of leaders.keys()) leaders.set(k, true);
      for (const k of quiet.keys()) quiet.set(k, true);
    },
    clear: () => {
      leaders.clear();
      quiet.clear();
    },
  };
}

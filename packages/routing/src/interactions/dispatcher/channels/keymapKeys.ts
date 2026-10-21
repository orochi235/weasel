/** What the keyboard channel remembers about keystrokes that opened or went to a keymap. */
import type { KeymapStack } from '../../../keymaps/keymapStack';

export interface KeymapKeys {
  /** Whether autorepeat of `physical` is to be dropped: it is a leader still down, or its keystroke closed a keymap. */
  quiet(physical: string): boolean;
  /** Run one keystroke's dispatch and note what it did to the keymaps. */
  press(e: KeyboardEvent, physical: string, run: () => void): void;
  /** A key came up. */
  up(e: KeyboardEvent, physical: string): void;
  clear(): void;
}

export function keymapKeys(stack: () => KeymapStack | undefined): KeymapKeys {
  // Leader keys still down, each with whether Cmd was held when it went down.
  const leaders = new Map<string, boolean>();
  const quiet = new Set<string>();
  const release = (physical: string): void => {
    if (leaders.delete(physical)) stack()?.release(`key:${physical}`);
  };
  return {
    quiet: (physical) => leaders.has(physical) || quiet.has(physical),
    press: (e, physical, run) => {
      const before = stack()?.innermost() ?? null;
      run();
      const s = stack();
      if (s?.holdOpened(`key:${physical}`)) leaders.set(physical, e.metaKey);
      // Its repeats would otherwise reach whatever the key does outside the keymap it just closed.
      else if (before !== null && s?.innermost() !== before) quiet.add(physical);
    },
    up: (e, physical) => {
      quiet.delete(physical);
      release(physical);
      // macOS sends no keyup for a key released while Cmd is down, so Cmd's own keyup releases it.
      if (e.key === 'Meta') for (const [k, withCmd] of [...leaders]) if (withCmd) release(k);
    },
    clear: () => {
      leaders.clear();
      quiet.clear();
    },
  };
}

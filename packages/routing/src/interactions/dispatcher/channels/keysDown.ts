/** The keys down on a page, those holding a gesture, and their release when their keyup comes or cannot. */
import type { DispatchCore } from '../dispatchCore';
import type { InputEvent } from '../matcher';
import type { KeymapKeys } from './keymapKeys';
import { releaseIn, type HeldKey } from './overKeys';

type Mods = Pick<KeyboardEvent, 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'>;
const NO_MODS: Mods = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };

/** The `keyHeld` up event releasing `down`, with the modifiers of `mods`. */
function releaseOf(down: HeldKey, mods: Mods): InputEvent {
  return {
    kind: 'keyHeld', key: down.key, ...(down.code !== undefined ? { code: down.code } : {}), phase: 'up',
    altKey: mods.altKey, ctrlKey: mods.ctrlKey, metaKey: mods.metaKey, shiftKey: mods.shiftKey,
  };
}

export const physicalKey = (e: KeyboardEvent): string => e.code || e.key.toLowerCase();

export interface KeysDown {
  /** Every key down on the page, taken or not, for `arrive` to press again. */
  readonly down: Map<string, Omit<HeldKey, 'on' | 'view'>>;
  /** Held keys by physical key, mapped to the `key` they went down as (Shift pressed mid-hold makes the keyup of
   *  an 'o' press report 'O') and the dispatcher that took the down, which hover may have routed away from. */
  readonly held: Map<string, HeldKey>;
  /** Cmd went down: every key down now may lose its keyup, so Cmd's own keyup stands in for theirs. */
  cmdDown(): void;
  /** A key came up: release it, and with Cmd's, every key that went down while Cmd was. */
  up(e: KeyboardEvent): void;
  /** End every held key, as a window that lost focus must: it never delivers the keyup. */
  releaseAll(): void;
}

export function keysDown(core: Pick<DispatchCore, 'dispatch' | 'routedView' | 'setRoutedView'>, keymaps: KeymapKeys): KeysDown {
  const held = new Map<string, HeldKey>();
  const down = new Map<string, Omit<HeldKey, 'on' | 'view'>>();

  const keyUp = (physical: string, e: KeyboardEvent): void => {
    down.delete(physical);
    const key = held.get(physical);
    if (key === undefined) return;
    held.delete(physical);
    releaseIn(core, key, releaseOf(key, e));
  };

  return {
    down,
    held,
    // macOS sends no keyup for a key released while Cmd is down.
    cmdDown: () => {
      for (const [k, key] of down) down.set(k, { ...key, withCmd: true });
      for (const [k, key] of held) held.set(k, { ...key, withCmd: true });
      keymaps.cmdDown();
    },
    up: (e) => {
      const physical = physicalKey(e);
      keymaps.up(e, physical);
      keyUp(physical, e);
      if (e.key !== 'Meta') return;
      for (const [k, key] of [...down, ...held]) if (key.withCmd) keyUp(k, e);
    },
    releaseAll: () => {
      down.clear();
      keymaps.clear();
      const releasing = [...held.values()];
      held.clear();
      for (const key of releasing) releaseIn(core, key, releaseOf(key, NO_MODS));
    },
  };
}

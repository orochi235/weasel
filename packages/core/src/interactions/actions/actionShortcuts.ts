/**
 * Project an action's keyboard bindings into the shape a shortcut chip
 * renders from (`formatShortcut` / `formatShortcutParts` in
 * `@weasel-js/ui`). Palette and menu surfaces show what an action answers
 * to; the dispatcher reads the specs themselves.
 */
import type { Action } from './registry';
import { actionBindings } from './registry';

/** One keyboard shortcut, flattened for display. Structurally the
 *  `ShortcutInput` weasel-ui formats — kept local so core doesn't depend on
 *  the UI package. */
export interface ActionShortcut {
  key: string;
  mod: boolean;
  alt: boolean;
  shift: boolean;
}

/**
 * Every keyboard shortcut an action answers to, in declaration order.
 *
 * Two kinds of collapsing, both because a binding list is written for a
 * matcher rather than for a reader:
 *
 * - A spec's `key` may list spellings of one keycap (`['[', '{']` — the
 *   shifted bracket reports as `'{'`). The first is the shortcut's name.
 * - A modifier declared `'optional'` matches held or unheld, so it isn't
 *   part of what the user has to press. Bindings left identical by that are
 *   emitted once.
 *
 * Non-keyboard bindings (drag, wheel, click) have no chip form and are
 * skipped; an action bound only to those returns empty. A *required* `ctrl`
 * or `meta` has no chip form either — nothing in the kit declares one, and
 * the display shape carries only `mod`.
 */
export function actionShortcuts(action: Action): readonly ActionShortcut[] {
  const out: ActionShortcut[] = [];
  const seen = new Set<string>();
  for (const { spec } of actionBindings(action)) {
    if (spec.kind !== 'key' && spec.kind !== 'key-held') continue;
    const key = Array.isArray(spec.key) ? spec.key[0] : spec.key;
    if (typeof key !== 'string' || key.length === 0) continue;
    const mods = 'mods' in spec ? spec.mods : undefined;
    const shortcut: ActionShortcut = {
      key,
      mod: mods?.mod === true,
      alt: mods?.alt === true,
      shift: mods?.shift === true,
    };
    const token = `${shortcut.key}|${shortcut.mod}|${shortcut.alt}|${shortcut.shift}`;
    if (seen.has(token)) continue;
    seen.add(token);
    out.push(shortcut);
  }
  return out;
}

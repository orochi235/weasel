/**
 * Project an action's keyboard bindings into the shape a shortcut chip
 * renders from (`formatShortcut` / `formatShortcutParts` in
 * `@weasel-js/ui`). Palette and menu surfaces show what an action answers
 * to; the dispatcher reads the specs themselves.
 */
import type { GestureSpec } from '../gestures/spec';
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
 * The chip form of a single gesture spec, or `undefined` when the spec has
 * none.
 *
 * Two kinds of collapsing, both because a binding list is written for a
 * matcher rather than for a reader:
 *
 * - A spec's `key` may list spellings of one keycap (`['[', '{']` — the
 *   shifted bracket reports as `'{'`). The first is the shortcut's name.
 * - A modifier declared `'optional'` matches held or unheld, so it isn't
 *   part of what the user has to press.
 *
 * Non-keyboard specs (drag, wheel, click) have no chip form. Neither does a
 * *required* `ctrl` or `meta` — nothing in the kit declares one, and the
 * display shape carries only `mod`.
 */
export function keySpecShortcut(spec: GestureSpec): ActionShortcut | undefined {
  if (spec.kind !== 'key' && spec.kind !== 'key-held') return undefined;
  const key = Array.isArray(spec.key) ? spec.key[0] : spec.key;
  if (typeof key !== 'string' || key.length === 0) return undefined;
  const mods = 'mods' in spec ? spec.mods : undefined;
  return {
    key,
    mod: mods?.mod === true,
    alt: mods?.alt === true,
    shift: mods?.shift === true,
  };
}

/**
 * Every keyboard shortcut an action answers to, in declaration order.
 * Specs `keySpecShortcut` has no chip for are skipped, and bindings it leaves
 * identical are emitted once; an action bound only to those returns empty.
 */
export function actionShortcuts(action: Action): readonly ActionShortcut[] {
  const out: ActionShortcut[] = [];
  const seen = new Set<string>();
  for (const { spec } of actionBindings(action)) {
    const shortcut = keySpecShortcut(spec);
    if (!shortcut) continue;
    const token = `${shortcut.key}|${shortcut.mod}|${shortcut.alt}|${shortcut.shift}`;
    if (seen.has(token)) continue;
    seen.add(token);
    out.push(shortcut);
  }
  return out;
}

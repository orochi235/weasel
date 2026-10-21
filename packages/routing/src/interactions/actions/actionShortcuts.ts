/**
 * Project an action's keyboard bindings into the shape a shortcut chip
 * renders from (`formatShortcut` / `formatShortcutParts` in `@weasel-js/ui`).
 */
import type { GestureSpec } from '@weasel-js/gestures';
import type { MenuShortcut } from '@weasel-js/menu';
import type { Action } from './action';
import { actionBindings } from './binding';

/** One keyboard shortcut, flattened for display: the chip a menu row draws
 *  (`MenuShortcut` in `@weasel-js/menu`, `ShortcutInput` in `@weasel-js/gestures`). */
export type ActionShortcut = MenuShortcut;

/**
 * The chip form of a single gesture spec, or `undefined` when the spec has
 * none.
 *
 * - A spec's `key` may list spellings of one keycap (`['[', '{']` — the
 *   shifted bracket reports as `'{'`). The first is the shortcut's name.
 * - A modifier declared `'optional'` matches held or unheld, so it isn't
 *   part of what the user has to press.
 *
 * Non-keyboard specs (drag, wheel, click) have no chip form. Neither does a
 * *required* `ctrl` or `meta`: the display shape carries only `mod`.
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
 *
 * With `params` — an `ActionItem`'s — only the bindings that pass those same
 * values count, so each variant of `flip` gets its own key.
 */
export function actionShortcuts(
  action: Action,
  params?: Readonly<Record<string, unknown>>,
): readonly ActionShortcut[] {
  const out: ActionShortcut[] = [];
  const seen = new Set<string>();
  for (const { spec, opts } of actionBindings(action)) {
    if (params && !paramsMatch(opts?.params, params)) continue;
    const shortcut = keySpecShortcut(spec);
    if (!shortcut) continue;
    const token = `${shortcut.key}|${shortcut.mod}|${shortcut.alt}|${shortcut.shift}`;
    if (seen.has(token)) continue;
    seen.add(token);
    out.push(shortcut);
  }
  return out;
}

/** Whether `bound` (a binding's `opts.params`) carries every value in `wanted`. */
export function paramsMatch(bound: unknown, wanted: Readonly<Record<string, unknown>>): boolean {
  if (typeof bound !== 'object' || bound === null) return false;
  return Object.entries(wanted).every(([k, v]) => (bound as Record<string, unknown>)[k] === v);
}

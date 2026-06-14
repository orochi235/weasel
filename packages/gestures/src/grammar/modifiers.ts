/** All valid keys for a modifier sub-table in a route entry. Canonical
 *  order: mod → shift → alt (matches formatShortcut). */
export type ModifierCombo =
  | 'default'
  | 'mod' | 'shift' | 'alt'
  | 'mod+shift' | 'mod+alt' | 'shift+alt'
  | 'mod+shift+alt';

/** Convenience: produce the canonical ModifierCombo from modifiers passed
 *  in any order. Useful in computed property syntax:
 *
 *  ```ts
 *  'rect': {
 *    [mods('shift')]:        addToSelection,
 *    [mods('alt', 'shift')]: cloneAndAdd,    // → 'shift+alt'
 *  }
 *  ```
 */
export function mods(
  ...keys: ReadonlyArray<'mod' | 'shift' | 'alt'>
): ModifierCombo {
  if (keys.length === 0) return 'default';
  const set = new Set(keys);
  return [
    set.has('mod')   && 'mod',
    set.has('shift') && 'shift',
    set.has('alt')   && 'alt',
  ].filter(Boolean).join('+') as ModifierCombo;
}

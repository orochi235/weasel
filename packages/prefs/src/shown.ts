// A stored value as the control over its leaf shows it. A condition compares
// that, and not the stored form: a person writes "is on" about an Italic
// toggle, whatever string the toggle stores.

import type { PrefGroup, PrefSection } from './groups';
import { prefLeafHolding, UNSEEN } from './holding';
import type { PrefBoolean, PrefEnum, PrefLeaf } from './schema';

type Siblings = Record<string, unknown> | undefined;

/** What the control over `leaf` shows for `stored`: what its `encoding` reads it as, else `stored` itself.
 *  `siblings` is the object the leaf is a field of. */
export function prefShownValue(leaf: PrefLeaf, stored: unknown, siblings?: Siblings): unknown {
  if (leaf.kind !== 'boolean' && leaf.kind !== 'enum') return stored;
  const { encoding } = leaf as PrefBoolean | PrefEnum;
  return encoding ? (encoding.read as (stored: unknown, siblings: Siblings) => unknown)(stored, siblings) : stored;
}

/**
 * `read` with each value handed back as {@link prefShownValue} gives it, for
 * the leaf of `schema` at that path, a field of an `object` or a `union` leaf
 * included. A field's siblings are what `read` finds at its leaf's path.
 */
export function prefShownReader(schema: PrefGroup | PrefSection, read: (path: string) => unknown): (path: string) => unknown {
  return (path) => {
    const stored = read(path);
    const held = prefLeafHolding(schema, path);
    if (held === undefined || held === UNSEEN) return stored;
    const object = held.within === undefined ? undefined : read(held.within);
    return prefShownValue(held.leaf, stored, typeof object === 'object' && object !== null ? (object as Siblings) : undefined);
  };
}

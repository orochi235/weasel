// A stored value as the control over its leaf shows it. A condition compares
// that, and not the stored form: a person writes "is on" about an Italic
// toggle, whatever string the toggle stores.

import type { PrefConditionReader } from './condition';
import type { PrefGroup, PrefSection } from './groups';
import { prefLeafHolding, prefLeafHoldingIn, prefSchemaHolding, UNSEEN } from './holding';
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
 * included. A field's siblings are what `read` finds at its leaf's path. A
 * path read from the entry is held to `item`, the leaf describing that entry.
 * A path no leaf of `schema` holds is held to `over`, the schema it is drawn
 * over.
 */
export function prefShownReader(
  schema: PrefGroup | PrefSection, read: PrefConditionReader, item?: PrefLeaf, over?: PrefGroup | PrefSection,
): PrefConditionReader {
  return (path, from) => {
    const stored = read(path, from);
    const held = from === 'item' ? item && prefLeafHoldingIn(item, path) : prefLeafHolding(prefSchemaHolding(schema, path, over), path);
    if (held === undefined || held === UNSEEN) return stored;
    const object = held.within === undefined ? undefined : read(held.within, from);
    return prefShownValue(held.leaf, stored, typeof object === 'object' && object !== null ? (object as Siblings) : undefined);
  };
}
